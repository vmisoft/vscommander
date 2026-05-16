<#
  far-driver.ps1 - Windows automation helper for the `far-feature-spec` skill.

  Launches the real Far Manager, injects keyboard/mouse input, and captures
  its console screen as a colour ANSI text grid plus a PNG. Invoked per action
  from the WSL side via `powershell.exe -File <win-path> -Action <x> ...`.

  State (the running Far PID) is kept in <StateDir>\state.json so each
  separate invocation can re-attach to the same Far instance.

  Actions:
    launch    -StartDir <dir> [-Cols N] [-Rows N] [-FarExe <path>]
    sendkeys  -Keys "<spec>"      e.g. "key:F7;text:newdir;key:Enter"
    click     -Col N -Row N       left-click at a 1-based... (0-based here) cell
    capture   -Out <win-path>     writes <Out>.ansi.txt and <Out>.png
    quit
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('launch', 'sendkeys', 'click', 'capture', 'quit')]
    [string]$Action,
    [string]$Keys,
    [string]$Out,
    [int]$Col,
    [int]$Row,
    [string]$StartDir,
    [string]$FarExe = 'C:\Program Files\Far Manager\Far.exe',
    [int]$Cols = 120,
    [int]$Rows = 40,
    [string]$StateDir = "$env:TEMP\far-feature-spec"
)

$ErrorActionPreference = 'Stop'

# --- Win32 console interop -------------------------------------------------
$cs = @'
using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class FarDriver {
    [StructLayout(LayoutKind.Sequential)] public struct COORD { public short X; public short Y; }
    [StructLayout(LayoutKind.Sequential)] public struct SMALL_RECT { public short Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] public struct CHAR_INFO { public ushort Char; public ushort Attributes; }
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] public struct CONSOLE_SCREEN_BUFFER_INFO {
        public COORD dwSize; public COORD dwCursorPosition; public ushort wAttributes;
        public SMALL_RECT srWindow; public COORD dwMaximumWindowSize; }
    [StructLayout(LayoutKind.Sequential)] public struct KEY_EVENT_RECORD {
        public int bKeyDown; public ushort wRepeatCount; public ushort wVirtualKeyCode;
        public ushort wVirtualScanCode; public ushort UnicodeChar; public uint dwControlKeyState; }
    [StructLayout(LayoutKind.Sequential)] public struct MOUSE_EVENT_RECORD {
        public COORD dwMousePosition; public uint dwButtonState;
        public uint dwControlKeyState; public uint dwEventFlags; }
    [StructLayout(LayoutKind.Explicit)] public struct INPUT_RECORD {
        [FieldOffset(0)] public ushort EventType;
        [FieldOffset(4)] public KEY_EVENT_RECORD KeyEvent;
        [FieldOffset(4)] public MOUSE_EVENT_RECORD MouseEvent; }

    [DllImport("kernel32.dll", SetLastError = true)] static extern bool AttachConsole(uint pid);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool FreeConsole();
    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr GetStdHandle(int n);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool ReadConsoleOutputW(
        IntPtr h, [Out] CHAR_INFO[] buf, COORD bufSize, COORD bufCoord, ref SMALL_RECT region);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool WriteConsoleInputW(
        IntPtr h, INPUT_RECORD[] recs, uint len, out uint written);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool GetConsoleScreenBufferInfo(
        IntPtr h, out CONSOLE_SCREEN_BUFFER_INFO info);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetConsoleScreenBufferSize(IntPtr h, COORD size);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetConsoleWindowInfo(IntPtr h, bool abs, ref SMALL_RECT rect);
    [DllImport("kernel32.dll")] static extern IntPtr GetConsoleWindow();
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT r);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd, int cmd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32.dll")] static extern uint MapVirtualKey(uint code, uint mapType);
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern IntPtr CreateFileW(string name, uint access, uint share, IntPtr sec,
        uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool CloseHandle(IntPtr h);

    const uint GENERIC_RW = 0xC0000000, SHARE_RW = 0x3, OPEN_EXISTING = 3;
    // Windows console colour index -> ANSI colour index.
    static readonly int[] ConToAnsi = { 0, 4, 2, 6, 1, 5, 3, 7 };

    static void Attach(uint pid) {
        FreeConsole();
        if (!AttachConsole(pid))
            throw new Exception("AttachConsole failed for pid " + pid +
                " (Win32 error " + Marshal.GetLastWin32Error() + ")");
    }

    // Open the attached console's real buffer. GetStdHandle is wrong here:
    // this process's std handles are redirected pipes, not the console.
    static IntPtr Con(string name) {
        IntPtr h = CreateFileW(name, GENERIC_RW, SHARE_RW, IntPtr.Zero,
            OPEN_EXISTING, 0, IntPtr.Zero);
        if (h == new IntPtr(-1))
            throw new Exception("open " + name + " failed (Win32 error " +
                Marshal.GetLastWin32Error() + ")");
        return h;
    }

    public static int Launch(string farExe, string startDir) {
        var psi = new ProcessStartInfo(farExe);
        psi.UseShellExecute = true;            // gives Far its own console
        psi.WorkingDirectory = startDir;
        psi.Arguments = "\"" + startDir + "\" \"" + startDir + "\"";
        var p = Process.Start(psi);
        return p.Id;
    }

    public static void Resize(uint pid, short cols, short rows) {
        Attach(pid);
        try {
            IntPtr h = Con("CONOUT$");
            try {
                CONSOLE_SCREEN_BUFFER_INFO info;
                GetConsoleScreenBufferInfo(h, out info);
                // Grow the buffer first (always safe), fit the window inside
                // it, then trim the buffer to the exact target. Avoids the
                // "shrink window to 1x1 then fail to grow" trap.
                short bx = info.dwSize.X > cols ? info.dwSize.X : cols;
                short by = info.dwSize.Y > rows ? info.dwSize.Y : rows;
                SetConsoleScreenBufferSize(h, new COORD { X = bx, Y = by });
                SMALL_RECT win = new SMALL_RECT { Left = 0, Top = 0,
                    Right = (short)(cols - 1), Bottom = (short)(rows - 1) };
                SetConsoleWindowInfo(h, true, ref win);
                SetConsoleScreenBufferSize(h, new COORD { X = cols, Y = rows });
            } finally { CloseHandle(h); }
        } finally { FreeConsole(); }
    }

    public static void Capture(uint pid, string ansiPath, string pngPath) {
        Attach(pid);
        try {
            IntPtr h = Con("CONOUT$");
            CONSOLE_SCREEN_BUFFER_INFO info;
            if (!GetConsoleScreenBufferInfo(h, out info))
                throw new Exception("GetConsoleScreenBufferInfo failed");
            short w = (short)(info.srWindow.Right - info.srWindow.Left + 1);
            short ht = (short)(info.srWindow.Bottom - info.srWindow.Top + 1);
            CHAR_INFO[] buf = new CHAR_INFO[w * ht];
            SMALL_RECT region = info.srWindow;
            if (!ReadConsoleOutputW(h, buf, new COORD { X = w, Y = ht },
                    new COORD { X = 0, Y = 0 }, ref region))
                throw new Exception("ReadConsoleOutput failed");
            CloseHandle(h);

            StringBuilder sb = new StringBuilder();
            for (int y = 0; y < ht; y++) {
                int lastAttr = -1;
                for (int x = 0; x < w; x++) {
                    CHAR_INFO c = buf[y * w + x];
                    int attr = c.Attributes & 0xFF;
                    if (attr != lastAttr) {
                        int fg = attr & 0x0F, bg = (attr >> 4) & 0x0F;
                        int fgs = (fg >= 8 ? 90 : 30) + ConToAnsi[fg & 7];
                        int bgs = (bg >= 8 ? 100 : 40) + ConToAnsi[bg & 7];
                        sb.Append("[").Append(fgs).Append(';').Append(bgs).Append('m');
                        lastAttr = attr;
                    }
                    char ch = (char)c.Char;
                    sb.Append(ch == '\0' ? ' ' : ch);
                }
                sb.Append("[0m\n");
            }
            File.WriteAllText(ansiPath, sb.ToString(), new UTF8Encoding(false));

            // PNG: render the captured grid ourselves. Deterministic and
            // independent of the terminal host / window visibility.
            RenderPng(buf, w, ht, pngPath);
        } finally { FreeConsole(); }
    }

    // Standard 16-colour Windows console palette (index -> RGB).
    static readonly int[] Rgb = {
        0x000000, 0x000080, 0x008000, 0x008080, 0x800000, 0x800080, 0x808000, 0xC0C0C0,
        0x808080, 0x0000FF, 0x00FF00, 0x00FFFF, 0xFF0000, 0xFF00FF, 0xFFFF00, 0xFFFFFF };

    static void RenderPng(CHAR_INFO[] buf, int w, int ht, string pngPath) {
        const int cw = 9, ch_ = 16;
        Color[] pal = new Color[16];
        for (int i = 0; i < 16; i++)
            pal[i] = Color.FromArgb(255, (Rgb[i] >> 16) & 0xFF, (Rgb[i] >> 8) & 0xFF, Rgb[i] & 0xFF);
        using (Bitmap bmp = new Bitmap(w * cw, ht * ch_))
        using (Graphics g = Graphics.FromImage(bmp))
        using (Font font = new Font("Consolas", 11f, FontStyle.Regular, GraphicsUnit.Pixel)) {
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.SingleBitPerPixelGridFit;
            for (int y = 0; y < ht; y++) {
                for (int x = 0; x < w; x++) {
                    CHAR_INFO c = buf[y * w + x];
                    int attr = c.Attributes & 0xFF;
                    using (SolidBrush bg = new SolidBrush(pal[(attr >> 4) & 0x0F]))
                        g.FillRectangle(bg, x * cw, y * ch_, cw, ch_);
                    char ch = (char)c.Char;
                    if (ch != '\0' && ch != ' ') {
                        using (SolidBrush fg = new SolidBrush(pal[attr & 0x0F]))
                            g.DrawString(ch.ToString(), font, fg, x * cw - 1, y * ch_);
                    }
                }
            }
            bmp.Save(pngPath, ImageFormat.Png);
        }
    }

    public static void SendKey(uint pid, ushort vk, ushort ch, uint ctrl) {
        Attach(pid);
        try {
            IntPtr h = Con("CONIN$");
            ushort scan = (ushort)MapVirtualKey(vk, 0);
            INPUT_RECORD[] recs = new INPUT_RECORD[2];
            for (int i = 0; i < 2; i++) {
                recs[i].EventType = 1; // KEY_EVENT
                recs[i].KeyEvent = new KEY_EVENT_RECORD {
                    bKeyDown = (i == 0) ? 1 : 0, wRepeatCount = 1,
                    wVirtualKeyCode = vk, wVirtualScanCode = scan,
                    UnicodeChar = ch, dwControlKeyState = ctrl };
            }
            uint written;
            WriteConsoleInputW(h, recs, 2, out written);
            CloseHandle(h);
        } finally { FreeConsole(); }
    }

    public static void Click(uint pid, short col, short row) {
        Attach(pid);
        try {
            IntPtr h = Con("CONIN$");
            INPUT_RECORD[] recs = new INPUT_RECORD[2];
            recs[0].EventType = 2; // MOUSE_EVENT
            recs[0].MouseEvent = new MOUSE_EVENT_RECORD {
                dwMousePosition = new COORD { X = col, Y = row },
                dwButtonState = 1, dwEventFlags = 0 };          // left button down
            recs[1].EventType = 2;
            recs[1].MouseEvent = new MOUSE_EVENT_RECORD {
                dwMousePosition = new COORD { X = col, Y = row },
                dwButtonState = 0, dwEventFlags = 0 };          // release
            uint written;
            WriteConsoleInputW(h, recs, 2, out written);
            CloseHandle(h);
        } finally { FreeConsole(); }
    }
}
'@
Add-Type -TypeDefinition $cs -ReferencedAssemblies 'System.Drawing' | Out-Null

# --- key tables ------------------------------------------------------------
$VK = @{
    'F1' = 0x70; 'F2' = 0x71; 'F3' = 0x72; 'F4' = 0x73; 'F5' = 0x74; 'F6' = 0x75
    'F7' = 0x76; 'F8' = 0x77; 'F9' = 0x78; 'F10' = 0x79; 'F11' = 0x7A; 'F12' = 0x7B
    'Enter' = 0x0D; 'Esc' = 0x1B; 'Tab' = 0x09; 'Space' = 0x20; 'Backspace' = 0x08
    'Up' = 0x26; 'Down' = 0x28; 'Left' = 0x25; 'Right' = 0x27
    'Home' = 0x24; 'End' = 0x23; 'PageUp' = 0x21; 'PageDown' = 0x22
    'Insert' = 0x2D; 'Delete' = 0x2E
}
$MOD = @{ 'Ctrl' = 0x0008; 'Alt' = 0x0002; 'Shift' = 0x0010 }  # LEFT_CTRL/ALT, SHIFT

$stateFile = Join-Path $StateDir 'state.json'

function Get-FarPid {
    if (-not (Test-Path $stateFile)) { throw 'No Far instance - run the launch action first.' }
    [uint32]((Get-Content $stateFile -Raw | ConvertFrom-Json).pid)
}

function Send-NamedKey([string]$spec) {
    # spec: optional Ctrl+/Alt+/Shift+ prefixes then a key name (F7, Enter, A, ...)
    $parts = $spec.Split('+')
    $name = $parts[-1]
    $ctrl = 0
    foreach ($m in $parts[0..($parts.Length - 2)]) {
        if ($MOD.ContainsKey($m)) { $ctrl = $ctrl -bor $MOD[$m] }
    }
    if ($VK.ContainsKey($name)) {
        [FarDriver]::SendKey((Get-FarPid), [uint16]$VK[$name], [uint16]0, [uint32]$ctrl)
    }
    elseif ($name.Length -eq 1) {
        $up = [byte][char]([string]$name).ToUpper()
        [FarDriver]::SendKey((Get-FarPid), [uint16]$up, [uint16][char]$name, [uint32]$ctrl)
    }
    else { throw "Unknown key name: $name" }
    Start-Sleep -Milliseconds 50
}

function Send-Text([string]$text) {
    foreach ($c in $text.ToCharArray()) {
        $vk = 0
        if ([char]::IsLetterOrDigit($c)) { $vk = [byte][char]([string]$c).ToUpper() }
        [FarDriver]::SendKey((Get-FarPid), [uint16]$vk, [uint16][char]$c, [uint32]0)
        Start-Sleep -Milliseconds 25
    }
}

New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

switch ($Action) {
    'launch' {
        if (-not (Test-Path $FarExe)) { throw "Far.exe not found at: $FarExe" }
        if (-not $StartDir) { $StartDir = Join-Path $StateDir 'sandbox' }
        New-Item -ItemType Directory -Force -Path $StartDir | Out-Null
        $farPid = [FarDriver]::Launch($FarExe, $StartDir)
        Start-Sleep -Milliseconds 2000
        [FarDriver]::Resize([uint32]$farPid, [int16]$Cols, [int16]$Rows)
        Start-Sleep -Milliseconds 300
        @{ pid = $farPid; cols = $Cols; rows = $Rows; startDir = $StartDir } |
            ConvertTo-Json | Set-Content -Path $stateFile -Encoding UTF8
        Write-Output "launched pid=$farPid size=${Cols}x${Rows} dir=$StartDir"
    }
    'sendkeys' {
        if (-not $Keys) { throw '-Keys is required for sendkeys.' }
        foreach ($tok in $Keys.Split(';')) {
            $tok = $tok.Trim()
            if (-not $tok) { continue }
            if ($tok.StartsWith('key:')) { Send-NamedKey $tok.Substring(4) }
            elseif ($tok.StartsWith('text:')) { Send-Text $tok.Substring(5) }
            else { throw "Bad key token '$tok' - expected key:<name> or text:<literal>." }
        }
        Write-Output "sent: $Keys"
    }
    'click' {
        [FarDriver]::Click((Get-FarPid), [int16]$Col, [int16]$Row)
        Start-Sleep -Milliseconds 80
        Write-Output "clicked at $Col,$Row"
    }
    'capture' {
        if (-not $Out) { throw '-Out (a Windows path prefix) is required for capture.' }
        # Re-assert the console size before reading, in case Far reset it.
        $st = Get-Content $stateFile -Raw | ConvertFrom-Json
        [FarDriver]::Resize([uint32]$st.pid, [int16]$st.cols, [int16]$st.rows)
        Start-Sleep -Milliseconds 250
        $ansi = "$Out.ansi.txt"
        $png = "$Out.png"
        [FarDriver]::Capture([uint32]$st.pid, $ansi, $png)
        Write-Output "ansi=$ansi"
        Write-Output "png=$png"
    }
    'quit' {
        if (Test-Path $stateFile) {
            $farPid = (Get-Content $stateFile -Raw | ConvertFrom-Json).pid
            Stop-Process -Id $farPid -Force -ErrorAction SilentlyContinue
            Remove-Item $stateFile -ErrorAction SilentlyContinue
        }
        Write-Output 'quit'
    }
}
