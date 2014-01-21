gas
===
<p>Google Apps Script code.</p>
<p>GDriveNotify.gs - class to work with <a href="http://www.daspot.ru/2013/06/google-drive.html">
google drive notification code</a> (deprecated).</p>
<p>GDriveDog.gs - class to work with <a href="http://www.daspot.ru/2013/12/google-drive-2.html">
google drive notification code</a>.</p>
Example 1. Sending data via email:
```javascript
function myFunction() {
  var gdd = new GDriveDog(ScriptDb.getMyDb(), '0B0YcK5KeNe1tMnZieldHdnNVOFU'); // your folder's ID
  var msg = gdd.getMessage();
  if (msg.length > 0) {
    msg.unshift('Количество объектов: ' + msg.length);
    GmailApp.sendEmail(
      Session.getActiveUser().getEmail(),
      'Обнаружены изменения на Диске Google, каталог - ' + gdd.name,
      msg.join('\n')
    );
  }
}
```
[![ScreenShot](https://raw.github.com/dab00/gas/master/scr1.jpg)](http://youtu.be/P2BWY25u22k)

Example 2. Storing data in spreadsheet:
```javascript
function myFunction() {
  var gdd = new GDriveDog(ScriptDb.getMyDb(), '0B0YcK5KeNe1tMnZieldHdnNVOFU'); // your folder's ID
  var data = gdd.compare();
  if (!data.length) return;  
  var ss = SpreadsheetApp.openById('0AkYcK5KeNe1tdGpIaFJwMVlDSkRFbjFTczNESFdaWUE'); // your spreadsheet's id
  var sh = ss.getSheets()[0]; 
  for (var i=0; i<data.length; i++) {
    sh.appendRow([new Date(), data[i].obj.name, data[i].obj.id, data[i].prop, data[i].obj.openUrl]);
  }  
}
```
[![ScreenShot](https://raw.github.com/dab00/gas/master/scr2.jpg)](http://youtu.be/Xr5VgpxZz0E)
