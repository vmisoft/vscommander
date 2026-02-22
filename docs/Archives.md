# Archive Navigation

VSCommander can browse archive files as if they were
directories, replicating the Far Manager archive plugin
experience.

## Opening an Archive

Press `Enter` on an archive file to open it. The pane
switches to archive browsing mode -- the top border shows
the archive filename and current path within the archive.

## Navigation Inside Archives

  `Enter` on directory    Navigate into the directory
  `Enter` on `..`         Go up; at root, exit archive
  `Enter` on file         Extract to temp and open
  `Ctrl+PageUp`           Go up one level
  `Ctrl+PageDown`         Enter selected directory
  `F3` on file            Extract to temp and view
  `F4` on file            Extract to temp and edit

## Exiting

Navigate up past the archive root to exit and return to
the filesystem directory containing the archive file.

## Extracting Files (F5)

Press `F5` inside an archive to extract selected files
to the other pane's directory. The standard Copy dialog
appears. Directories are extracted recursively.

## Adding Files (F5)

When the other pane is inside an archive and you press
`F5`, the selected files are added to the archive. For
read-only formats (TAR, RAR), an error is shown.

## Deleting (F8)

Press `F8` inside an archive to delete selected entries.
Directories are deleted recursively. Read-only formats
show an error message.

## Make Directory (F7)

Press `F7` to create a new empty directory entry in the
archive. Read-only formats show an error message.

## Moving Files (F6)

Press `F6` inside an archive to move (extract + delete)
entries to the other pane. When the other pane is inside
an archive, files are added and deleted from filesystem.

## Supported Formats

  ZIP    `.zip`, `.jar`, `.war`, `.ear`, `.apk`
         Full write support (add, delete, mkdir)

  TAR    `.tar`, `.tar.gz`, `.tgz`, `.tar.bz2`,
         `.tbz2`, `.tar.xz`, `.txz`
         Read only

  7-Zip  `.7z`
         Add, delete, mkdir

  RAR    `.rar`
         Read only

## See Also

  [Copy Files](CopyFiles.md)
  [Delete Files](DeleteFile.md)
  [Keyboard Reference](KeyRef.md)
