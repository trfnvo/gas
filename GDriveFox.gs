/* Создаем объект: 
  var fox = new GDriveFox(args);
  Получаем права владельца файлов:
  fox.getRight();
  Примеры аргумента конструктора объекта - args:
  - запуск без триггера, "руками": 
  {funcName: 'myFunction', sourceFolderId: '01234'}
  - запуск по триггеру - наличие свойства triggerId - ОБЯЗАТЕЛЬНО (можно получить с помощью функции getTriggersId())
  {funcName: 'myFunction', sourceFolderId: '01234', triggerId: '09876'}
  - даем права владельца пользователю, отличному от владельца каталога, id которого передан в свойстве sourceFolderId:
  {funcName: 'myFunction', sourceFolderId: '01234', newOwner: mail@domain.com}
  - то же самое + удаляем суперадмина из списка редакторов
  {funcName: 'myFunction', sourceFolderId: '01234', newOwner: mail@domain.com, removeEditor: true}
  - сразу после присвоения прав владельца отзываем право прежнего пользователя изменять настройку доступа к файлу:
  {funcName: 'myFunction', sourceFolderId: '01234', revokeShareable: true}
  - сразу после присвоения прав владельца копируем файл в целевой каталог (добавляем файлу родительский каталог), 
    а также удаляем файл из корневого каталога (удаляем из списка родительских каталогов корневой каталог): 
  {funcName: 'myFunction', sourceFolderId: '01234', addFolderId: '05678'}
  - то же самое + отзываем право прежнего пользователя расшаривать файл:
  {funcName: 'myFunction', sourceFolderId: '01234', addFolderId: '05678', revokeShareable: true}
  - сразу после присвоения прав владельца копируем файл в целевой каталог (создаем новый файл - копию):
  {funcName: 'myFunction', sourceFolderId: '01234', copyFolderId: '05678'}
  - то же самое + удаляем исходный файл:
  {funcName: 'myFunction', sourceFolderId: '01234', copyFolderId: '05678', trash: true}
  - после выполнения скрипта сохраняем информацию о работе скрипта в таблицу: 
    количество каталогов, файлов, итераций, время работы, предупреждения, ошибки: 
  {funcName: 'myFunction', sourceFolderId: '01234', reportTableId: '04321'}
  - запуск с лимитом выполнения 180 секунд и автоматическим продолжением выполнения 
    в случае превышения лимита через 30 секунд, целевой каталог - корневой (по умолчанию):
  {funcName: 'myFunction', timeX: 180, timeOut: 30}
*/ 
var GDriveFox = (function() {
  return function (args) {
    if (typeof args !== 'object') {
      clearDb();
      throw new Error('Error: args - Неверный тип аргумента');
    }
    var t0 = Date.now(), 
        tOut = (args.timeOut && typeof args.timeOut === 'number') ? 1000 * args.timeOut : 62000 , 
        tX = (args.timeX && typeof args.timeX === 'number' && args.timeX < 300) ? 1000 * args.timeX : 300000; // 5 минут
    
    var funcName = (args.funcName && typeof args.funcName === 'string') ? args.funcName : 'myFunction';
    var rootFolder = DriveApp.getRootFolder(), 
        sourceFolder = (args.sourceFolderId && typeof args.sourceFolderId === 'string') ? DriveApp.getFolderById(args.sourceFolderId) : rootFolder, 
        sourceFolderId = sourceFolder.getId();    
    var newOwner = (args.newOwner && typeof args.newOwner === 'string') ? args.newOwner : rootFolder.getOwner().getEmail();
    var admin = Session.getEffectiveUser().getEmail();
    
    var fileToken, foldersLength = 0, filesLength = 0, it = 1, tY = t0, report = [];
    var options = getOptions(), 
        db = ScriptDb.getMyDb(), 
        foldersArr = getFoldersArr();

    if (args.addFolderId && typeof args.addFolderId === 'string') {
      try {
        var addFolder = DocsList.getFolderById(args.addFolderId);
        var rootFolder2 = DocsList.getFolderById(rootFolder.getId());
      } catch(e) {
        log('Warn: Не удалось получить каталог для добавления файлов');
      }
    }

    if (args.copyFolderId && typeof args.copyFolderId === 'string') {
      try {
        var copyFolder = DriveApp.getFolderById(args.copyFolderId);        
      } catch(e) {
        log('Warn: Не удалось получить каталог для копирования файлов');
      }
    }

    function getFoldersArr() {
      var dataIterator = db.query({id: sourceFolderId});
      if (!dataIterator.hasNext()) { // первый запуск        
        var arr = init();
        foldersLength = arr.length;
        return arr;
      }      
      return initNext(dataIterator);
    }

    function initNext(dataIterator) {
      var dataObj = dataIterator.next();
      
      if (!dataObj.folders || typeof dataObj.folders !== 'object' || !dataObj.fileToken || typeof dataObj.fileToken !== 'string' || 
          !dataObj.foldersLength || typeof dataObj.foldersLength !== 'number' || !dataObj.filesLength || 
          typeof dataObj.filesLength !== 'number' || !dataObj.it || typeof dataObj.it !== 'number' || 
          !dataObj.tY || typeof dataObj.tY !== 'number' || !dataObj.report || typeof dataObj.report !== 'object') {
        log('Error: ScriptDb - Неверный формат объекта');
        throw new Error('Error: ScriptDb - Неверный формат объекта');
      }                
      
      fileToken = dataObj.fileToken, foldersLength = dataObj.foldersLength, filesLength = dataObj.filesLength, it = dataObj.it, tY = dataObj.tY, report = dataObj.report;
      return dataObj.folders;
    }

    function init() { // примерно 2000 каталогов за 5 минут вытащит, +-
      var arr = [];
      initRec(sourceFolder);
      function initRec(folder) {
        arr.push(folder.getId());
        if (timeEx()) { // время вышло
          log('Warn: Не удалось получить список всех каталогов');
          return;
        } 
        var folders = folder.getFolders()
        while (folders.hasNext()) {         
          initRec(folders.next());
        }
      }
      if (saveBatch({id: sourceFolderId, folders: arr})) return arr;      
    }

    function saveBatch(dataObj) {
      var res = db.saveBatch([dataObj], false);
      if (db.allOk(res)) return true;
      log('Error: ScriptDb - Не удалось сохранить данные');
      clearDb();
      throw new Error('Error: ScriptDb - Не удалось сохранить данные'); // не удалось сохранить все объекты
    }

    function timeEx() {
      return (Date.now() - t0) > tX;
    }

    function getOptions() {
      var oAuth = new OAuth();    
      oAuth.method = 'POST';
      oAuth.payload = "<entry xmlns='http://www.w3.org/2005/Atom' xmlns:gAcl='http://schemas.google.com/acl/2007'>" + 
          "<category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/acl/2007#accessRule'/>" + 
          "<gAcl:role value='owner'/><gAcl:scope type='user' value='" + newOwner + "'/></entry>";
      oAuth.contentType = 'application/atom+xml';
      oAuth.headers = {'Cache-Control' : 'max-age=0'};      
      return oAuth;
    }

    function OAuth() {
      var oAuthConfig = UrlFetchApp.addOAuthService('docs');
      oAuthConfig.setRequestTokenUrl("https://www.google.com/accounts/OAuthGetRequestToken?scope=https://docs.google.com/feeds/");
      oAuthConfig.setAuthorizationUrl("https://www.google.com/accounts/OAuthAuthorizeToken");
      oAuthConfig.setAccessTokenUrl("https://www.google.com/accounts/OAuthGetAccessToken");
      oAuthConfig.setConsumerKey("anonymous");
      oAuthConfig.setConsumerSecret("anonymous");
      return {oAuthServiceName:"docs", oAuthUseToken:"always"};
    }

    this.getRight = function() {
      var folder, files;
      for (var i=0; i<foldersArr.length; i++) {
        folder = DriveApp.getFolderById(foldersArr[i]);
        files = (fileToken && i===0) ? DriveApp.continueFileIterator(fileToken) : folder.getFiles();
        while (files.hasNext()) {
          if (timeEx()) { // время вышло
            clearDb();
            saveBatch({id: sourceFolderId, 
                       folders: foldersArr.slice(i), 
                       fileToken: files.getContinuationToken(), 
                       foldersLength: foldersLength || foldersArr.length, 
                       filesLength: filesLength, 
                       it: ++it, 
                       tY: tY, 
                       report: report});
            ScriptApp.newTrigger(funcName).timeBased().after(tOut).create();
            return;
          }          
          changeOwner(files.next());
          filesLength++;
        }
      }
      clearDb();
      deleteTriggers();
      saveReport();
    }

    function changeOwner(file) {
      var owner = file.getOwner().getEmail();
      if (newOwner === owner) return;
      removeEditor(file, newOwner);
      try {       
        UrlFetchApp.fetch('https://docs.google.com/feeds/' + owner + '/private/full/' + file.getId() + '/acl?v=3&alt=json', options);
      } catch(e) {
        return log('Error: ' + e.message +  '\nUrlFetchApp: Не удалось изменить владельца файла ' + file.getName());
      }

      if (args.removeEditor) return removeEditor(file, admin);

      if (args.revokeShareable) file.setShareableByEditors(false);
      if (rootFolder2) return addToFolder(file.getId());
      if (copyFolder) {
        file.makeCopy(copyFolder);
        if (args.trash) file.setTrashed(true);
      }
    }

    function removeEditor(file, user) {
      try {
        file.removeEditor(user);
      } catch(e) {
        log('Warn: ' + e.message +  '\nНе удалось удалить редактора файла ' + file.getName());
      }
    }

    function addToFolder(id) {
      var file = DocsList.getFileById(id);
      file.addToFolder(addFolder);
      file.removeFromFolder(rootFolder2);
    }

    function clearDb() {
      try {
        var res = db.query({id: sourceFolderId});
        while (res.hasNext()) {
          db.remove(res.next());
        }
      } catch(e) {
        log('Error: ' + e.message + '\nScriptDB: Не удалось удалить данные');
      }
    }
    
    function deleteTriggers() {
      ScriptApp.getProjectTriggers().forEach(function(t){
        if (t.getUniqueId() !== args.triggerId) ScriptApp.deleteTrigger(t);
      });      
    }
    
    function log(msg) {
      Logger.log(msg);
      if (args.reportTableId) {
        report.push(msg);
      }
    }

    function saveReport() {
      var rep0 = 'Каталогов: ' + foldersLength + '\nФайлов: ' + filesLength + '\nИтераций: ' + it + 
                 '\nВремя работы: ' + ((Date.now() - tY + (it-1)*tOut)/1000) + ' секунд';
      var rep1 = 'Отчет:\n' + (report.length ? report.join('\n') : 'Everything gonna be alright');
      Logger.log("Looks like i'm done\n" + rep0 + '\n' + rep1);
      if (args.reportTableId && typeof args.reportTableId === 'string') {
        try {
          SpreadsheetApp.openById(args.reportTableId).getSheets()[0].appendRow([new Date(), rep0, rep1]);          
        } catch(e) {
          Logger.log('\nWarn: Не удалось сохранить отчет в таблицу');
        }
      }
    }
  }
})();

function getTriggersId() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    Logger.log(t.getUniqueId());
  }); 
}