# module-api
模块访问Api （Ajax）的一种方式（异想天开）。  
通过定义一系列常用的请求Api，在Http Ajax时， 定义服务对象后，仅需要使用 适应的api+action 即可。  
在代码紧凑的同时，不用再为 接口名称定义而烦恼了！！！

# Api
get/query   获取/查询  
post/do/set/add/save    提交/做/设置/添加/保存  
put  
patch  
delete/remove   物理删除/逻辑删除  

## 使用

```js

import ModuleApi from '../libs/module-api'

var api = new ModuleApi("Home"); // 一个服务域
    api.get("UserInfo"); // 调用指定服务
    api.query("UserList");
    api.post("UserInfo");
    api.do("User");
    api.set("UserInfo");
    api.save("UserInfo");
    api.put("UserInfo");
    api.patch("UserInfo");
    api.delete("UserInfo");
    api.remove("UserInfo");
    
    
var email = ModuleApi.module("Email"); // 自定义服务域
    email.do("sendEmail"); // 一个服务域

var link = ModuleApi.module("Email").link("sendPage", { userId: item.Id }); //一个自定义服务域的链接地址
    api.go(link);

```