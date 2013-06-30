function GDriveNotify(folderId, propName) {
  this.root = DriveApp.getFolderById(folderId) || DriveApp.getRootFolder();
  this.propName = propName || 'json';
}
// возвращает массив объектов - свойства каталогов и файлов
GDriveNotify.prototype.get = function() {
  var ret = [];
  getPropsRec(this.root);
  
  function getPropsRec(folder) {
    var obj = getFolderProp(folder); // каталог
    if (!isMatch(ret, obj)) ret.push(obj);    
    var files = folder.getFiles();
    while (files.hasNext()) { // файлы
      var obj = getFileProp(files.next());
      if (!isMatch(ret, obj)) ret.push(obj);
    }    
    var folders = folder.getFolders();
    while (folders.hasNext()) {
      getPropsRec(folders.next()); // рекурсия
    }
  }
  
  return ret;
  
  // получаем свойства каталога
  function getFolderProp(folder) {
    return {
      'id': folder.getId(), 
      'name': folder.getName(),          
      'created': folder.getDateCreated(), 
      'updated': folder.getLastUpdated(),     
      'openUrl': folder.getUrl(),     
      'description': folder.getDescription(), 
      'size': folder.getSize(), 
      'starred': folder.isStarred(), 
      'trashed': folder.isTrashed(), 
      'shareableByEditors': folder.isShareableByEditors(), 
      'files': getArr(folder.getFiles()), 
      'parents': getArr(folder.getParents())
    };
  }
  
  // получаем свойства файла
  function getFileProp(file) {
    return {
      'id': file.getId(), 
      'name': file.getName(),          
      'created': file.getDateCreated(), 
      'updated': file.getLastUpdated(), 
      'downloadUrl': file.getDownloadUrl(),
      'openUrl': file.getUrl(), 
      'type': file.getMimeType(), 
      'description': file.getDescription(), 
      'size': file.getSize(), 
      'starred': file.isStarred(), 
      'trashed': file.isTrashed(), 
      'shareableByEditors': file.isShareableByEditors(), 
      'parents': getArr(file.getParents())
    }
  }
  
  // ищем повторяющиеся данные
  function isMatch(ret, obj) {
    for (var i=0; i<ret.length; i++) {
      if (ret[i].id == obj.id) return true;
    }
  }
  
  // получаем массив
  function getArr(iterator) {
    var ret = [];
    while (iterator.hasNext()) {
      ret.push(iterator.next().getId())
    }
    return ret;
  }  
}

// возвращает массив объектов - свойства измененных каталогов и файлов
GDriveNotify.prototype.compare = function() {
  var arr1 = JSON.parse(ScriptProperties.getProperty(this.propName)) || []; // получаем свойство скрипта
  var arr2 = this.get(); // получаем свойства каталогов и файлов
  var ret = [];  
  
  for (var i=0; i<arr2.length; i++) { // получаем новые
    var gotIt = false;
    for (var j=0; j<arr1.length; j++) {        
      if (arr1[j].id == arr2[i].id) {
        gotIt = true;
        break;
      }
    }
    if (!gotIt) ret.push({'obj': arr2[j], 'prop': 'inserted'});      
  }
  
  for (var i=0; i<arr1.length; i++) { // получаем удаленные из корзины и сравниваем
    var gotIt = false;
    for (var j=0; j<arr2.length; j++) {
      if (arr1[i].id == arr2[j].id) {
        gotIt = true; 
        
        for (var prop in arr1[i]) { // сравниваем свойства
          var obj = {};
          if (prop == 'updated' || prop == 'created') { // к датам - особый подход              
            obj.prop1 = new Date(arr1[i][prop]).getTime();
            obj.prop2 = arr2[j][prop].getTime();
          }else if (prop == 'files' || prop == 'parents') { // к массивам тоже              
            obj.prop1 = arr1[i][prop].length;
            obj.prop2 = arr2[j][prop].length;           
          } else {
            obj.prop1 = arr1[i][prop];
            obj.prop2 = arr2[j][prop];
          }
          if (obj.prop1 != obj.prop2) {
            ret.push({'obj': arr2[j], 'prop': prop});
          }
        }
        
        break;
      } 
    }
    if (!gotIt) ret.push({'obj': arr1[i], 'prop': 'deleted'}); // удаленные из корзины
  }
  
  return ret;
}
