const fs = require('fs')
const path = require('path')
const deepAssign = require('./utils/deepAssign')
const deepClone = require('./utils/deepClone')
const deepMap = require('./utils/deepMap')
// const elog = require('./log')

let dataDirPath

function GetRandomNum (Min, Max) {
  var Range = Max - Min
  var Rand = Math.random()
  return (Min + Math.round(Rand * Range))
}

function placeHolder (data) {
  // 替换占位符
  // elog(data.results.items.length)
  let index = 0
  const getStartIndex = () => {
    let startIndex = 0
    if (data.results && data.results.pageBean) {
      startIndex = (data.results.pageBean.pageNo - 1) * data.results.pageBean.pageSize
    }
    return startIndex
  }
  const startIndex = getStartIndex()

  deepMap(data, (val, key, parent, tags) => {
    // elog(key, val, '>>', parent)
    if (typeof val === 'string') {
      let matchCallback = {
        'id': {
          type: 'number',
          value: function () {
            // elog(key, tags)
            if (!tags.length) return ''
            // console.log(startIndex)
            // 子集（数组）
            /*
            var tval = tags.map((el, i) => {
              var j = el + 1
              return i === 0 ? (startIndex + j) : j
            })
            return tval.join('-') // tags[0,1] => '1-2'
             */
            return tags[tags.length - 1] + 1 // tags[0,1] => '2'
          }
        },
        'index': {
          type: 'number',
          value: function () {
            return startIndex + (++index)
          }
        },
        'random': {
          type: 'number',
          value: function () {
            return GetRandomNum(100, 200)
          }
        },
        'times': {
          type: 'number',
          value: function () {
            return Date.now()
          }
        }
      }

      const replaceFn = function (a, b) {
        if (typeof matchCallback[b].value === 'function') {
          return matchCallback[b].value()
        } else {
          return a
        }
      }

      const matchField = val.match(/^{([^}]*)}$/)
      if (matchField) {
        let matchFieldName = matchField[1]
        // elog(matchField, matchFieldName)
        // 完全匹配
        parent[key] = val.replace(/^{([^}]*)}$/ig, replaceFn)
        // 类型转化
        let matchInfo = matchCallback[matchFieldName]
        if (matchInfo) {
          if (matchInfo.type === 'number' && !/\D/.test(parent[key])) {
            // elog(parent[key])
            parent[key] = Number(parent[key])
          }
        }
      } else {
        // 部分匹配
        parent[key] = val.replace(/{([^}]*)}/ig, replaceFn)
      }
    }
  })

  return data
}

function fastRoutes (jsonPath, req) {
  let rlt
  const defaultMap = {
    '_true': {success: true},
    '_false': {success: false},
    '_query': req.query,
    '_payload': req.body
  }

  if (defaultMap[jsonPath]) {
    rlt = defaultMap[jsonPath]
    return rlt
  } else {
    return false
  }
}

// 插件：自动补全响应接口
function acStructure (obj, ops) {
  // elog(obj)
  // 补全基本结构
  let rlt

  if (obj[ops.xoField] === false) {
    rlt = Object.assign({'message': '接口返回的错误信息……'}, obj)
  } else if (Object.prototype.hasOwnProperty.call(obj, ops.xoField)) {
    rlt = obj
  } else {
    rlt = {}
    rlt[ops.xoField] = true
    rlt[ops.dataField] = obj
  }

  return rlt
}

// 插件：完善列表数据
function acList (fileData, {fixCount, noPageBean, queryFields, totalCount}, req) {
  // elog(noPageBean)
  // 补全基本结构
  if (!noPageBean && fileData.items && fileData.items.length && !fileData.pageBean) {
    // 自动补全数据
    // elog(fixCount)
    if (!fixCount) {
      fileData.pageBean = {
        'pageNo': parseInt(req.query[queryFields.pageNo.name]) || queryFields.pageNo.value,
        'pageSize': parseInt(req.query[queryFields.size.name]) || fileData.items.length,
        'totalCount': fileData.items.length
      }
      return fileData
    }

    // 分页数据
    let {pageNo, pageSize} = fileData.pageBean = {
      'pageNo': parseInt(req.query[queryFields.pageNo.name]) || queryFields.pageNo.value,
      'pageSize': parseInt(req.query[queryFields.size.name]) || queryFields.size.value,
      'totalCount': totalCount
    }

    // 判断 pageNo 的合法性，超出最大分页数时
    let pageNoLimit = Math.ceil(totalCount / pageSize)
    if (pageNo > pageNoLimit) {
      pageNo = fileData.pageBean.pageNo = pageNoLimit
    }

    // 当前页需要返回的总记录数
    let curPageCount = Math.min(totalCount, pageSize)
    // 计算当前页需要补的记录数，基于 json 文件内的记录记录数，需要翻几翻
    let curPagefixRatio = (function (count, size) {
      // elog(count,size)
      if (count > size) {
        return 0
      }
      let a = size % count
      let b = parseInt(size / count)
      // 少了补
      if (a > 0) {
        b++
      }
      return b
    })(fileData.items.length, curPageCount)

    // 补足总记录数，例如 json 文件中只写了2条记录，size=10 count=100，那么需要补98条记录。
    // elog(curPagefixRatio)
    if (curPagefixRatio) {
      // 深度拷贝原有记录
      let oriData = deepClone(fileData.items)
      // 先填满当前页的记录数
      for (let i = 0; i < curPagefixRatio - 1; i++) {
        fileData.items = fileData.items.concat(deepClone(oriData))
      }
    }

    // 多了减
    let overCount = 0
    let dVal = pageNo * pageSize - totalCount
    if (dVal > 0) {
      overCount = dVal
    }
    // elog(dVal)
    fileData.items = fileData.items.slice(0, pageSize - overCount)
    // elog(fileData.items)
  }

  return fileData
}

function getJsonPath (req) {
  return req.params[0].replace(/^\/+|\/+$/, '')
}

function parseRedirectOne ({ key, val, req, reqPath }) {
  let rlt
  let tRegExp = new RegExp(key)
  // elog(key, reqPath)
  if (tRegExp.test(reqPath)) {
    // elog(val)
    if (typeof val === 'function') {
      rlt = val({
        'regExp': reqPath.match(tRegExp),
        'pathRegExpMatch': reqPath.match(tRegExp),
        'req': req,
        reqPath
      })
      // elog(key, rlt)
      rlt = typeof rlt === 'string' ? rlt : undefined
    } else {
      rlt = val
    }
  }
  // elog(key, rlt)
  return rlt
}

function ckRedirect (req, map) {
  let reqPath = getJsonPath(req)
  // eq url:/data/a1 = > a1
  // elog(reqPath)
  let rlt = {'redirect': false, 'newPath': ''}
  if (map) {
    let cbRlt
    if (map.constructor === Object) {
      // 只要匹配到将终止匹配
      for (let key in map) {
        cbRlt = parseRedirectOne({
          reqPath,
          key,
          val: map[key],
          req
        })
        // 跳出遍历
        if (typeof cbRlt === 'string') break
      }
    } else if (map.constructor === Array) {
      let matchRlts = []
      map.forEach(el => {
        let tRlt = parseRedirectOne({
          reqPath,
          key: el.regStr,
          val: el.callback,
          req
        })
        // elog(el.regStr, tRlt)
        if (tRlt !== undefined) {
          matchRlts.push(tRlt)
        }
      })
      // elog(matchRlts)
      cbRlt = matchRlts.length ? matchRlts.pop() : ''
    }
    // elog(cbRlt)
    // 如果非 / 打头，那就跳转请求
    if (typeof cbRlt === 'string') {
      rlt.redirect = !!/^\//.test(cbRlt)
      rlt.newPath = cbRlt
    }
  }
  return rlt
}

function setAllowOrigin (res) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS')
  // res.header("X-Powered-By",' 3.2.1')
  res.header('Content-Type', 'application/json;charset=utf-8')
}

module.exports = function (app, options) {
  if (!app) return

  function checkOpsPlugins (ops) {
    let defPs = {
      'fastMap': 1,
      'getFile': 1,
      'placeHolder': 1,
      'acStructure': 1,
      'acList': 1,
      'acQuery': 1
    }
    // 遍历配置，获取开启的插件列表
    for (let pname in defPs) {
      let pval = ops.plugins[pname]
      // elog(pname, pval)
      if (pval !== undefined) {
        // elog(pname, pval)
        if (pval === false || (pval.constructor === Object && pval.enable === false)) {
          defPs[pname] = 0
        }
      }
    }
    // elog(defPs)

    return defPs
  }

  // elog(options)
  // 全局配置
  let config = deepAssign({
    bodyParser: true,
    debug: false,
    delay: 0,
    reqPath: 'data',
    basePath: __dirname,
    dataPath: 'api',
    fileMap: null,
    plugins: {
      acStructure: {
        xoField: 'success',
        dataField: 'results'
      },
      acList: {
        queryFields: {
          size: { // 每页展示数量
            name: 'pageSize', // [String]，别名
            value: 10 // [Number]，默认值
          },
          pageNo: {
            name: 'pageNo', // [String]，别名
            value: 1 // [Number]，默认值
          }
        },
        fixCount: true,
        noPageBean: false,
        totalCount: 100 // [Number]，总记录数
      }
    },
    _usePlugins: {}

  }, options)

  // 校验插件配置
  config._usePlugins = checkOpsPlugins(config)

  if (!dataDirPath) {
    dataDirPath = path.join(config.basePath, config.dataPath)
  }

  // elog(dataDirPath)
  // elog(config)

  // header 为 json 时，不需要
  if (config.bodyParser) {
    const bodyParser = require('body-parser')
    app.use(bodyParser.json({
      limit: '99999kb'
    })) // for parsing application/json
    app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded
  }

  // 实现路由的响应
  app.use(`/${config.reqPath}/*`, function (req, res, next) {
    let jsonFilePath = getJsonPath(req)

    // 支持跨域
    setAllowOrigin(req)

    // 判断是否需要重定向
    let ckrdt = ckRedirect(req, config.fileMap)
    if (ckrdt.redirect) {
      res.redirect(ckrdt.newPath)
      return
    }

    // 判断自定 json 文件是否存在
    ckrdt.newPath && (jsonFilePath = ckrdt.newPath)
    // elog( jsonFilePath );
    // elog( req.query );
    // json 文件内定义的配置
    let tOps = null

    // 判断解析该请求时使用的插件
    const cPlugin = function (name, _ops) {
      if (!_ops) _ops = config
      return _ops._usePlugins[name]
    }

    if (!jsonFilePath) {
      let tRlt = {
        message: '错误！接口地址错误'
      }

      if (cPlugin('acStructure')) {
        tRlt.success = false
      }
      res.status(500).json(tRlt)
    } else {
      // 判断是否需要别名重定向
      let ckRlt = cPlugin('fastMap') ? fastRoutes(jsonFilePath, req) : false

      if (ckRlt) {
        // 补足统一响应结构
        cPlugin('acStructure') && (ckRlt = acStructure(ckRlt, config.plugins.acStructure))
        res.status(200).json(ckRlt)
      } else {
        // 获取json文件内容
        if (!cPlugin('getFile')) {
          res.status(404).json({
            message: '错误！接口不可用'
          })
          return
        }

        try {
          // 读取json文件
          let jsonStr = fs.readFileSync(path.resolve(dataDirPath, jsonFilePath + '.json'), 'utf8')
          // elog( jsonStr )
          let fileJSON = JSON.parse(jsonStr)
          tOps = {}
          // 读取json文件中的设置
          // elog(fileJSON)
          if (fileJSON._settings) {
            // 覆盖全局设置
            deepAssign(tOps, config, fileJSON._settings)
            // elog(tOps)
            // 获取插件设置
            tOps._usePlugins = checkOpsPlugins(tOps)
            // 读取后删除，防止在响应中出现
            delete fileJSON._settings
          } else {
            deepAssign(tOps, config)
          }

          let rsp = fileJSON
          // 该请求的响应配置
          // elog(tOps)
          // elog(fileJSON)
          // 开始依次执行内置插件
          // 补列表结构
          cPlugin('acList', tOps) && (rsp = acList(fileJSON, tOps.plugins.acList, req))
          // 补基本结构
          cPlugin('acStructure', tOps) && (rsp = acStructure(rsp, deepAssign({}, tOps.plugins.acStructure, config.plugins.acStructure)))
          // 返回查询对象
          cPlugin('acQuery', tOps) && (rsp._query = req.query)
          // 替换占位符
          cPlugin('placeHolder', tOps) && (rsp = placeHolder(rsp))
          // elog( rsp )
          setTimeout(function () {
            res.status(200).json(rsp)
          }, tOps.delay)
        } catch (err) {
          // throw err
          res.status(403).json({
            success: false,
            message: '错误！接口文件解析出错，' + err.message
          })
        }
      }
    }
  })
}
