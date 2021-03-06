# express-data-server

通过 express 服务模拟数据接口，可集成在项目代码中，将模拟数据与项目代码一并进行版本控制。接口是项目中前端代码的一个重要部分，应该被版本化记录下来，使得项目能在不使用真实接口的情况下独立运行。

## 安装
`npm install express-data-server --save-dev`

## 部署
```javascript
// build/server.js
var express = require('express');
var dataServer = require("express-data-server"); // 引入模块

var app = express();
var options = {
      // 请求路径
      reqPath:'data',
      basePath:__dirname,
      // 存放自定义 json 文件
      dataPath:"./api"
    };
dataServer(app,options); // 启动
```
执行 `node build/server.js` 后，访问 `http://127.0.0.1:3000/data/_true`，返回 `{success:true}`

## 使用
### 内置请求地址
如果在数据目录中没有创建任何 json 文件时，也有默认的请求接口，如下：

- `/data/_query?a=1&b=2` => `{a:"1",b:"2"}`，返回 get 请求的字段组成的响应。
- `/data/_payload` 同上，post、put 等提交的数据
- `/data/_false` => `{success:false}`
- `/data/_true` => `{success:true}`

### 自定义模拟接口数据
例如：在项目根目录新建目录 `api`，该文件夹下新建文件 `list.json`，写入 json 数据。

```javascript
// api/list.json
{
  "items": [{
    "id": 1,
    "name": "apple",
  }]
}

// http://127.0.0.1:3000/data/list
{
  "items": [{
    "id": 1,
    "name": "apple",
  }]
}
```
> 提示：所有接口请求均支持 REST

## 配置
影响所有请求接口，理论上对象的所有字段均非必填，当需要返回自定义数据时，则必填字段：`basePath`、`dataPath`。

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
| :-- | :-- | :-- | :-- | :-- |
| reqPath | String | 是 | - | 请求目录，例如：`data`，即 /data/api_1 |
| basePath | String | 是 | - | 一般为该文件的父目录路径，例如：`__dirname` |
| dataPath | String | 是 | - | 数据存放的目录名，是 basePath 的相对路径，例如：'../api' |
| debug | Boolean | - | false | 是否打印调试信息 |
| bodyParser | Boolean | - | true | 是否启用包 body-parser |
| delay | number | - | 0 | 设置延迟返回的毫秒数 |
| fileMap | Object | - | - | url 与 json文件的关联映射表 |
| plugins | Array\|Object | -| - | 启用的插件 |

#### fileMap 说明&举例
`fileMap` 没有默认值，因为默认情况是以文件名访问的。当配置如下时：
```javascript
{
  "a(\\d+)b(\\d+)": "file1", // 请求 /api/a1b2 将响应 file1.json 内容
  "hello": "file2", // 请求 /api/aaa 将响应 file2.json 内容
  "baidu": "//www.baidu.com" // 将会 304 跳转
}
```
值的类型，支持数组：
```javascript
{
  fileMap :[{
    "regStr: ".*",
    "callback": function({regExp, req, reqPath}){
      // exp => [GET]request: /api/a1b2
      let {originalUrl, method, baseUrl} = req
      console.log(originalUrl) // /api/a1b2
      console.log(baseUrl) // /api
      console.log(method) // GET
      console.log(reqPath) // a1b2

      return originalUrl
    }
  }]
}
```

#### plugins 说明&举例
类型：Array，默认值如下：

| 字段 | 说明 |
| :---|:--- |
| fastMap | 预设的内置接口 |
| getFile | 获取 JSON 文件数据 |
| placeHolder | 替换数据内的占位符 |
| acStructure | 补全基本结构 |
| acList | 补全列表特种的数据结构 |
| acQuery | 补全请求时的 query 数据 |


##### placeHolder
`placeHolder` 提供了三种占位符，支持拼接。其使用如下：
```javascript
{
  "random":"{random}", // 100 到 200 之间的随机整数
  "times":"{times}", // 时间戳
  "id": "{id}_{index}",  // 从1开始递增的整数
}
```

##### acStructure [Boolean|Object]
如果想禁用某个插件，传入 `false`，如果需要修改默认配置，请传入对象：
```javascript
{
  "plugins": {
    "acStructure":{
      "xoField":"success",
      "dataField":"results"
    }
  }
}
```

访问：`http://127.0.0.1:3000/data/aaa` 时，会去找 `test1.json` 文件，且 `http://127.0.0.1:3000/data/test1` 依旧可访问。


### 文件中的配置
仅仅影响该文件的请求，有部分参数是可以在 json 文件中字段 `_settings` 配置的，但仅对这个 json 有效，和全局配置重名的字段，会覆盖全局配置项。保留字段均放在 `_settings` 中。

```javascript
{
  "name1": "value1",
  "name2": "value2",
  "_settings": {
    "plugins": {
      "placeHolder":false, // 关闭插件
      "acList": {
        "enable":true, // [Boolean], 默认 true，只有设置为 false 时，可关闭该插件
        "noPageBean": true, // [Boolean]，默认 false，响应时不补全 pageBean 字段
        "queryFields": {
          "size": { // 每页展示数量
            "name": "pageSize", // [String]，别名
            "value": 10 // [Number]，默认值
          },
          "pageNo": {
            "name": "pageNo", // [String]，别名
            "value": 1 // [Number]，默认值
          }
        },
        "totalCount": 100, // [Number]，设置总记录数，默认值100
        "fixCount":true // [Boolean]，默认 true，按 pageSize 补足当前页的记录数
      }
    }
  }
}
```

> 注意：json 文件中的配置优先级 > 全局配置优先级

## ChangeLog
### 0.9.0
- feature 修改 placeHolder 插件，实现数据值按字段名称不同类型不同，例如 id 是数字类型。
### 0.8.2
- fix 解析值为 undefined、null 出错。
### 0.8.1
- feature 添加 eslint 配置。
- fileMap 支持 数组。
### 0.8.0
- feature 修改 placeHolder 插件中占位符 id，可深度匹配。
### 0.7.0
- feature 新增 acStructure 插件的配置参数。
### 0.6.3
- fix 将解析提交数据的限制大小改为 '99999kb' 。
### 0.6.2
- fix 占位符解析错误。
### 0.6.1
- fix 设定默认配置参数。
### 0.6.0
- 删除参数 pluginsOptions 。
- 支持在单个json文件内关闭插件。
- feature 对插件 acList 新增参数 fixCount 字段。
### 0.5.2
- fix 插件 acList 中，当 pageSize 大于 totalCount 时，返回 totalCount 条记录。
### 0.5.1
- 变更占位符的执行方式。
- 新增占位符 index。
- 占位符支持拼接。
### 0.5.0
- 新增延迟返回参数 delay。
### 0.4.0
- 列表插件新增参数 totalCount，可限定总记录数，满足翻页超出总页数时。
### 0.3.2
- fix 占位符 {id} 的值与分页数据关联。
### 0.3.1
- 升级 uojo-kit 包。
### 0.3.0
- 新增 当执行插件 `fastMap` 后，再执行 `acStructure`，即所有输出前都先执行 `acStructure` 。
### 0.2.1
- fix checkOpsPlugins 。
### 0.2.0
- 参数 plugins 支持对象方式设置。
### 0.1.0
- 第一版本。
