var {elog} = require('uojo-kit')
var express = require('express')
var commander = require('commander')
var dataServer = require('../src/index')

// 示例化
var app = express()
// 跨域设置
app.all('*', (req, res, next) => {
  // console.log('all *',req.method, req.url, req.body)
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS')
  next()
})
app.get('/redirect', (req, res) => {
  res.set('Content-Type', 'text/plain').end('跳转成功')
// res.send({message:'跳转成功'})
})

// 配置cli
commander
  .option('-s, --scene [name]', '使用场景', '')
  .parse(process.argv)
var dsOptions = {
  reqPath: 'data',
  dataPath: './api',
  basePath: __dirname,
  debug: true
}
console.log(commander.scene)
switch (commander.scene) {
  case 'acStructure':
    Object.assign(dsOptions, {
      plugins: {
        'acStructure': {
          xoField: 'code',
          dataField: 'td'
        }
      }
    })
    break
  case 'fileMap':
    // 支持对象
    let fileMapObj = {
      '.*': ({regExp, req, reqPath}) => {
        let {method, originalUrl} = req
        elog('.*', regExp, method, originalUrl)
        return reqPath
      },
      'a1': '_true',
      'baidu': '/redirect',
      'a(\\d+)b(\\d+)': ({regExp, req}) => {
        // elog(regExp)
        // elog(req.method)
        // elog(req.query)
        // elog(req.body)
        return '_true'
      }
    }
    // 支持数组
    let fileMapArr = []
    for (let key in fileMapObj) {
      let val = fileMapObj[key]
      fileMapArr.push({regStr: key, callback: val})
    }

    Object.assign(dsOptions, {
      fileMap: fileMapArr
    })

    break
  default:
    break
}
dataServer(app, dsOptions)

var bs = require('browser-sync').create()
var port = 3000
var _port = port - 1
app.listen(_port, function (err) {
  if (err) {
    elog(err)
    return
  }

  // 访问代理服务，文件变更后触发浏览器刷新
  bs.init({
    open: false,
    ui: false,
    notify: false,
    logLevel: 'silent',
    proxy: '127.0.0.1:' + _port,
    watchOptions: {
      ignoreInitial: true
      // ignored: '*.txt'
    },
    files: [
      {
        match: ['./src/**', './**'],
        fn: function (e) {
          bs.reload()
        }
      }
    ],
    port: port
  })

  var uri = '127.0.0.1:3000'
  elog('Listening at ' + uri + '\n')
})
