#!/bin/bash 
# @echo off
# if exist ..\..\build (
#    rmdir /s/q ..\..\build
# ) 

# if exist ..\..\bin (
#    rmdir /s/q ..\..\bin
# ) 
# node index.js

# cd ..\
# gulp build

# @pause
if [ -d "../../build" ] ; then 
    rm -rf "../../build"
fi
if [ -d "../../bin" ] ; then
    rm -rf "../../bin"
fi
node index.js
result=$?
if [ "${result}" != "0" ]; then
	echo "执行node index.js失败了"
	exit 1
fi 
gulp build
result=$?
if [ "${result}" != "0" ]; then
	echo "执行gulp build失败了"
	exit 1
else 
    echo "执行gulp build完成"
fi 
 