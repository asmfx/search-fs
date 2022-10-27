# @asmfx/search-fs package

This package contains basic operations for handling search in file system.

## find

`find` function provides search interface to recursively traversing and find files/directories starting from `startingPath` directory.  

```
import { find } from "@asmfx/search-fs"

... 
const result = await find(startingPath, { pattern: /SOME_REGEX_PATTERN_FOR_SEARCH/g });
...

```

## grep

`grep` function provides search interface to recursively traversing in the filesystem and searching for content inside the provided files. 

```
import { find } from "@asmfx/search-fs"

... 
const result = await grep(paths, { pattern: /SOME_REGEX_PATTERN_FOR_SEARCH/g });
...

```