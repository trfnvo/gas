Google Apps Script code
=======================

#### Warning! None of these solutions is not working at the moment due to the closure by Google of some essential services


**GDriveFox.gs** - getting owner's rights on files on Google Drive

Example 1. Getting owner's rights on files located in folder with id = 01234 manually:
```javascript
var fox = new GDriveFox({sourceFolderId: '01234'});
fox.getRight();
```
Example 2. Getting owner's rights on files located in folder with id = 01234 by trigger, 
triggerId - required, can be retrieved using function getTriggersId():
```javascript
var fox = new GDriveFox({funcName: 'myFunction', sourceFolderId: '01234', triggerId: '09876'});
fox.getRight();
```
[![ScreenShot](https://raw.github.com/dab00/gas/master/scr/scr4.jpg)](http://youtu.be/JWvlmo-wVFA)

**GDriveDog.gs** - getting notification on changes on Google Drive. [Read details...](http://www.daspot.ru/2013/12/google-drive-2.html)

Example 1. Sending data via email:
```javascript
function myFunction() {
  var dog = new GDriveDog(ScriptDb.getMyDb(), '0B0YcK5KeNe1tMnZieldHdnNVOFU'); // your folder's ID
  var msg = dog.getMessage();
  if (msg.length > 0) {
    msg.unshift('Количество объектов: ' + msg.length);
    GmailApp.sendEmail(
      Session.getActiveUser().getEmail(),
      'Обнаружены изменения на Диске Google, каталог - ' + dog.name,
      msg.join('\n')
    );
  }
}
```
[![ScreenShot](https://raw.github.com/dab00/gas/master/scr/scr1.jpg)](http://youtu.be/P2BWY25u22k)

Example 2. Storing data in spreadsheet:
```javascript
function myFunction() {
  var dog = new GDriveDog(ScriptDb.getMyDb(), '0B0YcK5KeNe1tMnZieldHdnNVOFU'); // your folder's ID
  var data = dog.compare();
  if (!data.length) return;  
  var ss = SpreadsheetApp.openById('0AkYcK5KeNe1tdGpIaFJwMVlDSkRFbjFTczNESFdaWUE'); // your spreadsheet's id
  var sh = ss.getSheets()[0]; 
  for (var i=0; i<data.length; i++) {
    sh.appendRow([new Date(), data[i].obj.name, data[i].obj.id, data[i].prop, data[i].obj.openUrl]);
  }  
}
```
[![ScreenShot](https://raw.github.com/dab00/gas/master/scr/scr2.jpg)](http://youtu.be/Xr5VgpxZz0E)

Example 3. Sending data via sms:
```javascript
function myFunction() {
  var dog = new GDriveDog(ScriptDb.getMyDb(), '0B0YcK5KeNe1tMnZieldHdnNVOFU'); // your folder's ID
  var data = dog.compare();
  if (!data.length) return;  
  var msg = data.map(function(obj){return obj.obj.name + ':\n' + obj.obj.openUrl}).join('\n\n');
  var calendar = CalendarApp.getCalendarsByName('Dog')[0]; // your calendar's name
  if (!calendar) return;  
  var eventDate = new Date(Date.now() + 120000);  
  calendar.createEvent('Dog', eventDate, eventDate, {description: msg});
}
```
[![ScreenShot](https://raw.github.com/dab00/gas/master/scr/scr3.jpg)](http://youtu.be/i5l3_KX4B_0)

**GDriveNotify.gs** - getting notification on changes on Google Drive (deprecated). [Read details...](href="http://www.daspot.ru/2013/06/google-drive.html)