# VS Code Kick Assembler Studio

Code your way into the past with full support for kick assembler in visual studio code!
Support for debugging using vice, hover text showing contextual help, on the fly error evaluation and automatic tasks generation.

![commodore 64 logo](https://upload.wikimedia.org/wikipedia/commons/2/2c/Commodore_64_logo.png)

## Features

### Contextual help
![test](https://user-images.githubusercontent.com/35506206/76687921-3442c880-6620-11ea-970e-11da9f0aa085.gif)

### On the fly error evaluation
![onflyerrors](https://user-images.githubusercontent.com/35506206/76908128-e805bb80-689f-11ea-88bb-140e626399ad.gif)

### Search for references and go to definition
![Follow reference](https://user-images.githubusercontent.com/35506206/89225416-10cde980-d5d2-11ea-9747-4fc406f57fd1.png)

### Automatic tasks generation
![taskgeneration](https://user-images.githubusercontent.com/35506206/77233973-07079480-6ba3-11ea-8c75-89c292cfeb8f.gif)

### Vice Debugger
![vice debugger](https://user-images.githubusercontent.com/35506206/77234972-22c26900-6baa-11ea-9bec-050480c9376d.gif)

### Watch formated labels and memory addresses
![watches](https://user-images.githubusercontent.com/35506206/89222951-d3fff380-d5cd-11ea-86c0-ce3bca251c5f.png)
You can watch the value of a particular memory address or label. The format can be determinate in this way

(\*|\#)(type:)labelOrAddress([length])

*Examples:*
- message  <-  Will show the value of the label 'message' in hexadecimal , as hexadecimal is the default value
- c:message <- Will show the value of the label 'message' in character, just one character
- c:message[11] <- Will show 11 consecutive values in charactes or a string of length 11 if you will  starting from the lable 'message'
- #message <- Will show the memory address of the label 'message'
- \*c:pointerToMessage[11] <- Will use the memory address (2 bytes) in the label pointerToMessage (in litte endian, lower byte first, hight byte second, watch that value and format it as a string of length 11
- \*\*pointerToPointer <- will apply the same indirection twice, so if pointerToPointer contains the memory address of pointerToMessage, and pointerToMessage contains the memory addres of message, this will show the content of message formated in a string of length 11

*Types*
- h: hexadecimal, the default type. Is not necessary to specify it
- d: decimal
- b: binary
- c: character
- l: boolean, will show False if the value of the content is 0, True otherwise




## Configuration options
- `kickass-studio.kickAssJar`: "Full path to KickAss.jar"
- `kickass-studio.javaBin`: "Full path to java binary"
- `kickass-studio.viceBin`: "Full path to VICE binary"
- `kickass-studio.outputDir`: "The default output directory for the compiled program"

## Credits

Santiago Montero

https://github.com/sanmont

https://twitter.com/sanmonterodev

Special thanks to Captain JiNX for his great vscode-kickass extension which code was partially used to develop this extension.
(Used under MIT license)

Check out his awesome extension! 

https://github.com/CaptainJiNX/vscode-kickass-c64
