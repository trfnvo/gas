var GDriveDog = (function () {
  function GDriveDog(db, itemId) { // конструктор
    try {
      this.db = db;
      this.dbSize = db.query({}).getSize(); // размер хранилища, заодно проверяем наличие объекта
    } catch(e) {
      throw new Error(e.message);
      return;
    }
    if (typeof itemId === 'string') {
      try{
        this.root = DriveApp.getFolderById(itemId);
      } catch(e) {
        throw new Error(e.message);
        return;
      }
      this.id = itemId;
    } else {
      this.root = DriveApp.getRootFolder();
      this.id = this.root.getId();
    }
    this.name = this.root.getName();
  }
  
  GDriveDog.prototype.getDb = function() { // получаем содержимое хранилища
    var ret = [], db = this.db, res = db.query({id: this.id}), item;
    while (res.hasNext()) {
      item = res.next();
      ret = ret.concat(item['data']);
    }
    return ret;
  }
  
  GDriveDog.prototype.clearDb = function() { // удаляем содержимое хранилища
    var db = this.db, res = db.query({id: this.id});
    while (res.hasNext()) {
       db.remove(res.next());
    }
    return true;
  }
  
  GDriveDog.prototype.updateDb = function(arr) { // обновляем содержимое хранилища
    this.clearDb(); // удаляем
    var db = this.db, data = arr || this.get(); // получаем
    var res = db.saveBatch([{id: this.id, data: data}], false); // обновляем
    if (db.allOk(res)) {
      return true;
    }
    return false; // не удалось сохранить все объекты
  }
    
  GDriveDog.prototype.get = function() { // получаем свойства каталогов и файлов
    var ret = [];    
    getPropsRec(this.root);
    return ret;
    
    function getPropsRec(folder) {
      var obj = getProps(folder, true); // каталог
      if (!match(obj)) ret.push(obj); // пропускаем одни и те же объекты
      var files = folder.getFiles();
      while (files.hasNext()) { // файлы
        var obj = getProps(files.next(), false);        
        if (!match(obj)) ret.push(obj);
      }    
      var folders = folder.getFolders();      
      while (folders.hasNext()) { // каталоги
        getPropsRec(folders.next()); // рекурсия        
      }      
    }      
    
    // ищем повторяющиеся данные - на случай если объекты находятся сразу в нескольких каталогах
    function match(obj) {
      for (var i=0; i<ret.length; i++) {
        if (ret[i].id == obj.id) return true;
      }
    }
    
    // получаем массив id 
    function getIdArr(iterator) {
      var ret = [];
      while (iterator.hasNext()) {
        ret.push(iterator.next().getId());
      }
      return ret;
    }  
    
    // получаем массив email
    function getEmailArr(arr) {
      var ret = [];
      for (var i=0; i<arr.length; i++) {
        ret.push(arr[i].getEmail());
      }
      return ret;
    }  
    
    // получаем свойства объектов
    function getProps(item, isFolder) {
      var ret = {
        'created': String(item.getDateCreated()), 
        'description': item.getDescription(), 
        'editors': getEmailArr(item.getEditors()),         
        'id': item.getId(), 
        'updated': String(item.getLastUpdated()),
        'name': item.getName(),          
        'owner': item.getOwner().getEmail(),
        'parents': getIdArr(item.getParents()),
        'sharingAccess': String(item.getSharingAccess()),
        'sharingPermission': String(item.getSharingPermission()),
        'size': item.getSize(),      
        'openUrl': item.getUrl(),
        'viewers': getEmailArr(item.getViewers()),
        'shareableByEditors': item.isShareableByEditors(), 
        'starred': item.isStarred(), 
        'trashed': item.isTrashed()
      }
      if (isFolder) {
        ret.files = getIdArr(item.getFiles());
        ret.folders = getIdArr(item.getFolders());
      } else {
        ret.downloadUrl = item.getDownloadUrl();
        ret.type = item.getMimeType();
      }
      return ret;
    }    
  }
  
  GDriveDog.prototype.compare = function() { // сравниваем свойства объектов с данными хранилища
    var ret = [], arr2 = this.get(), arr1 = this.getDb();
    
    for (var i=0; i<arr2.length; i++) { // получаем новые
      var gotIt = false;
      for (var j=0; j<arr1.length; j++) {        
        if (arr1[j].id == arr2[i].id) {
          gotIt = true;
          break;
        }
      }
      if (!gotIt) ret.push({'obj': arr2[i], 'prop': 'inserted'});      
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
              obj.prop2 = new Date(arr2[j][prop]).getTime();
            } else if (prop == 'files' || prop == 'folders' || prop == 'parents' || prop == 'editors' || prop == 'viewers') { // к массивам тоже              
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
    this.updateDb(arr2);
    return ret;  
  }
  
  GDriveDog.prototype.getMessage = function(arr) { // собираем сообщение
    var ret = [], updated = arr || this.compare();
    for (var i=0; i<updated.length; i++) {
      var arr = [];
      switch (updated[i].prop) {
        case 'inserted':
          arr.push('Новый объект:');         
          arr.push('- дата создания - ' + updated[i].obj.created);         
          break;
        case 'deleted':
          arr.push('Объект удален:');                  
          break;
        case 'created':
          arr.push('Изменилась дата создания:');         
          arr.push('- дата создания - ' + updated[i].obj.created);          
          break;
        case 'updated':
          arr.push('Изменилась дата редактирования:');          
          arr.push('- дата редактирования - ' + updated[i].obj.updated);          
          break;
        case 'description':
          arr.push('Изменилось описание:');          
          arr.push('- описание - ' + updated[i].obj.description);          
          break;
        case 'name':
          arr.push('Изменилось имя:');          
          break;
        case 'owner':
          arr.push('Изменился владелец:');          
          arr.push('- владелец - ' + updated[i].obj.owner);          
          break;
        case 'parents':
          arr.push('Изменилось количество родительских объектов:');          
          arr.push('- количество - ' + updated[i].obj.parents.length);          
          break;
        case 'size':
          arr.push('Изменился размер:');          
          arr.push('- размер - ' + updated[i].obj.size);          
          break;
        case 'editors':
          arr.push('Изменилось количество редакторов:');          
          arr.push('- количество - ' + updated[i].obj.editors.length);          
          break;
        case 'viewers':
          arr.push('Изменилось количество обозревателей:');         
          arr.push('- количество - ' + updated[i].obj.viewers.length);          
          break;
        case 'files':
          arr.push('Изменилось количество файлов:');         
          arr.push('- количество - ' + updated[i].obj.files.length);          
          break;
        case 'folders':
          arr.push('Изменилось количество каталогов:');  
          arr.push('- количество - ' + updated[i].obj.folders.length);          
          break;
        case 'starred':
          if (updated[i].obj.starred) {
            arr.push('Объект отмечен звездочкой:');
          } else {
            arr.push('Отметка объекта звездочкой снята:');
          }          
          break;
        case 'trashed':
          if (updated[i].obj.trashed) {
            arr.push('Объект перемещен в корзину');
          } else {
            arr.push('Объект восстановлен из корзины');
          }          
          break;
        default:
          arr.push('Свойства объекта изменились:');          
          arr.push('- свойство - ' + updated[i].prop);
          arr.push('- значение - ' + updated[i].obj[updated[i].prop]);                    
          break;
      }
      arr.push('- имя - ' + updated[i].obj.name);
      arr.push('- ссылка - ' + updated[i].obj.openUrl);
      ret.push(arr.join('\n'));
    }    
    return ret;
  }
  
  return GDriveDog;
})();
