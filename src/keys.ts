// Navigation
export const KEY_UP = '\x1b[A';
export const KEY_DOWN = '\x1b[B';
export const KEY_RIGHT = '\x1b[C';
export const KEY_LEFT = '\x1b[D';
export const KEY_HOME = '\x1b[H';
export const KEY_HOME_ALT = '\x1b[1~';
export const KEY_END = '\x1b[F';
export const KEY_END_ALT = '\x1b[4~';
export const KEY_PAGE_UP = '\x1b[5~';
export const KEY_PAGE_DOWN = '\x1b[6~';

// Actions
export const KEY_ENTER = '\r';
export const KEY_TAB = '\t';
export const KEY_SHIFT_TAB = '\x1b[Z';
export const KEY_ESCAPE = '\x1b';
export const KEY_DOUBLE_ESCAPE = '\x1b\x1b';
export const KEY_SPACE = ' ';
export const KEY_DELETE = '\x1b[3~';
export const KEY_BACKSPACE = '\x7f';
export const KEY_BACKSPACE_ALT = '\x08';
export const KEY_INSERT = '\x1b[2~';

// Control characters
export const KEY_CTRL_C = '\x03';
export const KEY_CTRL_H = '\x08';
export const KEY_CTRL_P = '\x10';
export const KEY_CTRL_Q = '\x11';
export const KEY_CTRL_R = '\x12';
export const KEY_CTRL_U = '\x15';

// Function keys
export const KEY_F1 = '\x1bOP';
export const KEY_F2 = '\x1bOQ';
export const KEY_F3 = '\x1bOR';
export const KEY_F4 = '\x1bOS';
export const KEY_F5 = '\x1b[15~';
export const KEY_F6 = '\x1b[17~';
export const KEY_F7 = '\x1b[18~';
export const KEY_F8 = '\x1b[19~';
export const KEY_F9 = '\x1b[20~';
export const KEY_F10 = '\x1b[21~';

// Ctrl+Function keys
export const KEY_CTRL_F1 = '\x1b[1;5P';

// Shift+Function keys
export const KEY_SHIFT_F1 = '\x1b[1;2P';
export const KEY_SHIFT_F2 = '\x1b[1;2Q';
export const KEY_SHIFT_F3 = '\x1b[1;2R';
export const KEY_SHIFT_F4 = '\x1b[1;2S';
export const KEY_SHIFT_F5 = '\x1b[15;2~';
export const KEY_SHIFT_F6 = '\x1b[17;2~';
export const KEY_SHIFT_F7 = '\x1b[18;2~';
export const KEY_SHIFT_F8 = '\x1b[19;2~';
export const KEY_SHIFT_F9 = '\x1b[20;2~';
export const KEY_SHIFT_F10 = '\x1b[21;2~';
export const KEY_SHIFT_F11 = '\x1b[23;2~';
export const KEY_SHIFT_F12 = '\x1b[24;2~';

// Alt+Function keys
export const KEY_ALT_F1 = '\x1b[1;3P';
export const KEY_ALT_F1_ESC = '\x1b\x1bOP';
export const KEY_ALT_F2 = '\x1b[1;3Q';
export const KEY_ALT_F2_ESC = '\x1b\x1bOQ';
export const KEY_ALT_F3 = '\x1b[1;3R';
export const KEY_ALT_F3_ESC = '\x1b\x1bOR';
export const KEY_ALT_F4 = '\x1b[1;3S';
export const KEY_ALT_F4_ESC = '\x1b\x1bOS';
export const KEY_ALT_F5 = '\x1b[15;3~';
export const KEY_ALT_F6 = '\x1b[17;3~';
export const KEY_ALT_F7 = '\x1b[18;3~';
export const KEY_ALT_F8 = '\x1b[19;3~';
export const KEY_ALT_F9 = '\x1b[20;3~';
export const KEY_ALT_F10 = '\x1b[21;3~';

// Shift+navigation
export const KEY_SHIFT_DELETE = '\x1b[3;2~';
export const KEY_SHIFT_UP = '\x1b[1;2A';
export const KEY_SHIFT_DOWN = '\x1b[1;2B';
export const KEY_SHIFT_RIGHT = '\x1b[1;2C';
export const KEY_SHIFT_LEFT = '\x1b[1;2D';
export const KEY_SHIFT_PAGE_UP = '\x1b[5;2~';
export const KEY_SHIFT_PAGE_DOWN = '\x1b[6;2~';
export const KEY_SHIFT_HOME = '\x1b[1;2H';
export const KEY_SHIFT_END = '\x1b[1;2F';

// Ctrl+navigation
export const KEY_CTRL_LEFT = '\x1b[1;5D';
export const KEY_CTRL_RIGHT = '\x1b[1;5C';
export const KEY_CTRL_UP = '\x1b[1;5A';
export const KEY_CTRL_DOWN = '\x1b[1;5B';
export const KEY_CTRL_HOME = '\x1b[1;5H';
export const KEY_CTRL_END = '\x1b[1;5F';
export const KEY_CTRL_PAGE_UP = '\x1b[5;5~';
export const KEY_CTRL_PAGE_DOWN = '\x1b[6;5~';
export const KEY_CTRL_ENTER = '\x1b[13;5u';
export const KEY_CTRL_F12 = '\x1b[24;5~';

// Alt+navigation
export const KEY_ALT_DOWN = '\x1b[1;3B';
export const KEY_ALT_ENTER = '\x1b\r';

// Ctrl+number
export const KEY_CTRL_1 = '\x1b[49;5u';
export const KEY_CTRL_2 = '\x1b[50;5u';
export const KEY_CTRL_3 = '\x1b[51;5u';

// Ctrl+bracket
export const KEY_CTRL_BRACKET_LEFT = '\x1b[91;5u';
export const KEY_CTRL_BRACKET_RIGHT = '\x1d';
export const KEY_CTRL_BRACKET_RIGHT_ALT = '\x1b[93;5u';

// Numpad
export const KEY_NUMPAD_STAR = '\x1bOj';
export const KEY_NUMPAD_PLUS = '\x1bOk';
export const KEY_NUMPAD_MINUS = '\x1bOm';

// Mouse protocol prefixes
export const MOUSE_SGR_PREFIX = '\x1b[<';
export const MOUSE_X10_PREFIX = '\x1b[M';
