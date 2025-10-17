@echo off
chcp 65001 >nul
cd /d "%~dp0"
C:\Java\22\bin\java.exe -cp "target\classes;%USERPROFILE%\.m2\repository\org\springframework\boot\spring-boot-starter-web\2.7.3\*;%USERPROFILE%\.m2\repository\org\springframework\boot\spring-boot-starter-security\2.7.3\*;%USERPROFILE%\.m2\repository\io\jsonwebtoken\jjwt-api\0.11.5\*;%USERPROFILE%\.m2\repository\io\jsonwebtoken\jjwt-impl\0.11.5\*;%USERPROFILE%\.m2\repository\io\jsonwebtoken\jjwt-jackson\0.11.5\*" -Dspring.profiles.active=dev com.XiaoYing.FileBrowserApplication