@echo off
if exist ..\..\build (
   rmdir /s/q ..\..\build
) 

if exist ..\..\bin (
   rmdir /s/q ..\..\bin
) 
node index.js

cd ..\
gulp build

@pause