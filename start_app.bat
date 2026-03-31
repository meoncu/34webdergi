@echo off
title 34 Web Dergi Baslatici
echo Uygulama baslatiliyor (34_web_dergi)...
echo Lutfen acilan terminal penceresini kapatmayin.

cd /d "c:\Cursor\34_web_dergi"

:: Tarayiciyi biraz gecikmeli olarak acmasi icin start komutundan once ping veya timeout kullanabiliriz.
start http://localhost:3030

:: NextJS uygulamasini baslat
call npx next dev -p 3030
