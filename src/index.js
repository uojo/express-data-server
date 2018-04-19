const fs = require("fs");
const path = require("path");
const bodyParser = require('body-parser')
const {elog} = require('uojo-kit');

let dataDirPath;
function assignDeep(){
	var len = arguments.length;
	if(len<1){return false;}
	if(len==1){return arguments[0];}
	
	function isObj(val){
		return val && val.constructor === Object;
	}
	var queues = []
	for(var i=0;i<arguments.length;i++){
		if( isObj( arguments[i] ) ){
			queues.push(arguments[i])
		}
	}
	var dest = queues[0];
	
	function _as(dd,sd){
		for (var key in sd) {
			// console.log(key,sd[key])
			var val;
			if( isObj(sd[key]) ){
				if( dd.hasOwnProperty(key) ){
					if( isObj(dd[key]) ){
						val = _as(dd[key],sd[key])
						
					}else{
						val = sd[key]
					}
					
				}else{
					val = _as({}, sd[key])
				}
				
			}else{
				val = sd[key]
				
			}
			// console.log(key,val)
			dd[key] = val;
		}
		// console.log(dd)
		return dd;
	}
	
	// 从第二个开始
	for(var i=1;i<len;i++){
		var sd = queues[i];
		_as(dest,sd);
	}
	return dest;
}

function cloneDeep(obj, white){
	// console.info( white );
	// var self = this.cloneObj;
	var o, obj, white;
	// console.log(this);
	// console.info( obj.constructor, obj.valueOf() );
	// console.info( obj.constructor, obj.valueOf() );
	
	if (obj.constructor == Object || obj.constructor == Array){
		o = new obj.constructor();
		
	}else{
		// console.info( obj.valueOf() );
		o = new obj.constructor(obj.valueOf());
		
	}
	
	for(var key in obj){
		// console.info( o[key] != obj[key], key, obj[key] );
		
		// 通过白名单过滤对象【默认不过滤】
		if( white && !white[key] && obj.constructor!=Array ) break;

		if ( o[key] != obj[key] ){
		
			if ( typeof(obj[key]) == 'object' ){
				// console.log( "-Object or Array" );

				o[key] = cloneDeep(obj[key], white);

			}else{	//console.log( 2 );

				o[key] = obj[key];

			}
		}
	}

	return o;
};

function mapDeep(data,callback){
	if(typeof data ==='object'){
		function _map(da){
			for(key in da){
				var td = da[key];
				// console.log(typeof td,td)
				if(typeof td!=='object'){
					callback(td,key,da)
				}else{
					_map(td)
				}
			}
		}
		
		_map(data);
	}
	
	return data;
};

function GetRandomNum(Min,Max){
	var Range = Max - Min;   
	var Rand = Math.random();   
	return(Min + Math.round(Rand * Range));   
}

function placeHolder(data){
	// 替换占位符
	let id=0, index=0;
	// elog(data.results.items.length)
	mapDeep(data,(val,key,parent)=>{
		// elog(key,val)
		if( typeof val === 'string' ){
			let getIndex = function(){
				let startIndex = 0;
				if(data.results && data.results.pageBean){
					startIndex = (data.results.pageBean.pageNo-1) * data.results.pageBean.pageSize;
				}
				return startIndex+(++index);
			}
			let match_cb = {
				'id':getIndex,
				'index':getIndex,
				'random':function(){
					return GetRandomNum(100,200);
				},
				'times':function(){
					return Date.now();
				},
			}

			parent[key] = val.replace(/{([^}]*)}/ig,function(a,b){
				if(match_cb[b]){
					return match_cb[b]()
				}
			});

		}
	})
	
	return data;
}

function fastRoutes(jsonPath,req){
	let rlt
	const defaultMap={
		'_true':{success:true},
		'_false':{success:false},
		'_query':req.query,
		'_payload':req.body
	}
	
	if( defaultMap[jsonPath] ){
		rlt = defaultMap[jsonPath]
		return rlt;
	}else{
		return false;
	}
	
}

// 插件：自动补全响应接口
function acStructure(obj){
	// elog(obj)
	// 补全基本结构
	let rlt
	
	if( obj.success == false ){
		rlt = Object.assign({'message':"接口返回的错误信息……"},obj);
		
	}else if( Object.prototype.hasOwnProperty.call(obj, 'success') ){
		rlt = obj;
		
	}else{
		rlt = {
			success:true,
			results : obj,
		};
	}
	
	return rlt;
}

// 插件：完善列表数据
function acList(fileData, {fixCount, noPageBean, queryFields, totalCount}, req){
	// elog(noPageBean)
	// 补全基本结构
	if( !noPageBean && fileData.items && fileData.items.length && !fileData.pageBean ){
    // 自动补全数据
    // elog(fixCount)
    if(!fixCount){
      fileData.pageBean = {
        "pageNo": parseInt(req.query[queryFields.pageNo.name]) || queryFields.pageNo.value,
        "pageSize": parseInt(req.query[queryFields.size.name]) || fileData.items.length,
        "totalCount": fileData.items.length
      }
      return fileData;
    }

		// 分页数据
		let {pageNo,pageSize} = fileData.pageBean = {
			"pageNo": parseInt(req.query[queryFields.pageNo.name]) || queryFields.pageNo.value,
			"pageSize": parseInt(req.query[queryFields.size.name]) || queryFields.size.value,
			"totalCount": totalCount
		}

		// 判断 pageNo 的合法性，超出最大分页数时
		let pageNoLimit = Math.ceil(totalCount/pageSize);
		if(pageNo>pageNoLimit){
			pageNo = fileData.pageBean.pageNo = pageNoLimit;
		}
      
    // 当前页需要返回的总记录数
    let curPageCount = Math.min(totalCount, pageSize);
    // 计算当前页需要补的记录数，基于 json 文件内的记录记录数，需要翻几翻
    let curPagefixRatio = (function(count,size){
      // elog(count,size)
      if(count>size){
        return 0;
      }
      let a = size%count, b = parseInt(size/count);
      // 少了补
      if(a>0){
        b++
      }
      return b;
    })(fileData.items.length, curPageCount);

    // 补足总记录数，例如 json 文件中只写了2条记录，size=10 count=100，那么需要补98条记录。
    // elog(curPagefixRatio)
    if(curPagefixRatio){
      // 深度拷贝原有记录
      let oriData = cloneDeep(fileData.items);
      // 先填满当前页的记录数
      for(let i=0;i<curPagefixRatio-1;i++){
        fileData.items = fileData.items.concat( cloneDeep(oriData) )
      }
    }
    
    // 多了减
    let overCount = 0, dVal = pageNo*pageSize-totalCount;
    if(dVal>0){
      overCount = dVal;
    }
    // elog(dVal)
    fileData.items = fileData.items.slice(0,pageSize-overCount);
    // elog(fileData.items)

	}
	
	return fileData;
}

function getJsonPath(req){
	return req.params[0].replace(/^\/+|\/+$/,'');
}

function ckRedirect(req, map){
	let jsonPath = getJsonPath(req);
	let rlt={'redirect':false,'newPath':''}
	if(map){
		let tpath;
		for(let key in map){
			let tRegExp = new RegExp(key);
			// elog(jsonPath, tRegExp.test(jsonPath), key, map[key]);
			if( tRegExp.test(jsonPath) ){
				tpath = map[key];
				if(typeof tpath==='function'){
					tpath = tpath.call(undefined, {
						'regExp':jsonPath.match(tRegExp),
						'pathRegExpMatch':jsonPath.match(tRegExp),
						'req':req
					})
				}
				rlt.redirect=false;
				break;
			}
		}
		
		// 如果非 / 打头，那就跳转请求
		if( tpath && /^\//.test(tpath) ){
			rlt.redirect = true;
		}
		rlt.newPath = tpath
	}
	return rlt;
}

function setAllowOrigin(res){
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");  
	res.header("Access-Control-Allow-Methods","PUT,POST,GET,DELETE,OPTIONS");
	// res.header("X-Powered-By",' 3.2.1')
	res.header("Content-Type", "application/json;charset=utf-8");
}

module.exports = function(app, options){
	
	if(!app)return;
	
	function checkOpsPlugins(ops){
		let defPs = {
			'fastMap':1,
			'getFile':1,
			'placeHolder':1,
			'acStructure':1,
			'acList':1,
			'acQuery':1
		};
		// ops._usePlugins = !ops._usePlugins.length || defPs;
		// if(ops._usePlugins)return;
		// 遍历配置，获取开启的插件列表
		for(let pname in defPs){
			let pval = ops.plugins[pname];
			// elog(pname, pval)
			// elog(pval)
			if(pval!=undefined){
				// elog(pname)
				// elog(pval)
				if(pval==false || ( pval.constructor === Object && pval.enable == false) ){
					defPs[pname] = 0;
				}
			}
		}
		// elog(defPs)

		return defPs;
	}
	// 校验插件配置
	options._usePlugins = checkOpsPlugins(options);
	
	// elog(options)
	// 全局配置
	let ops = assignDeep({
		bodyParser:true,
		debug:false,
		delay:0,
    reqPath:"data",
    basePath: __dirname,
    dataPath:'api',
		fileMap:null,
		plugins:{
			acList:{
				queryFields:{
					size:{ // 每页展示数量
						name:"pageSize", // [String]，别名
						value:10 // [Number]，默认值
					},
					pageNo:{
						name:"pageNo", // [String]，别名
						value:1 // [Number]，默认值
					}
				},
				fixCount:true,
				noPageBean:false,
				totalCount:100 // [Number]，总记录数
			}
		},
		_usePlugins:{}
		
	},options);
	
	if(!dataDirPath){
		dataDirPath = path.join(ops.basePath, ops.dataPath)
	}
	
	// elog(dataDirPath)
	// elog(ops)
	
	// header 为 json 时，不需要
	if(ops.bodyParser){
		app.use( bodyParser.json() ); // for parsing application/json
		app.use( bodyParser.urlencoded({ extended: true }) ); // for parsing application/x-www-form-urlencoded
	}
	
	// 实现路由的响应
	app.use(`/${ops.reqPath}/*`,function(req,res,next){
		let jsonPath = getJsonPath(req);
		
		// 支持跨域
		setAllowOrigin(req);
		
		// 判断是否需要重定向
		let ckrdt = ckRedirect(req, ops.fileMap)
		if( ckrdt.redirect ){
			res.redirect(ckrdt.newPath)
			return;
		}

		// 判断自定json文件是否存在
		ckrdt.newPath && (jsonPath = ckrdt.newPath)
		// elog( jsonPath );
		// elog( req.query );
		// json 文件内定义的配置
		let tOps=null;

		// 判断解析该请求时使用的插件
		const cPlugin = function(name, _ops){
			if(!_ops) _ops = ops;
			return _ops._usePlugins[name];
		}
		
		if(!jsonPath){
			let t_rlt={
				message:"错误！接口地址错误"
			};
			
			if( cPlugin('acStructure') ){
				t_rlt.success=false
			}
			res.status(500).json(t_rlt);
			
		}else{
			// 判断是否需要别名重定向
			let ck_rlt = cPlugin('fastMap')? fastRoutes(jsonPath,req) :false;
			
			if( ck_rlt ){
				// 补足统一响应结构
				cPlugin('acStructure') && (ck_rlt = acStructure(ck_rlt));
				res.status(200).json(ck_rlt);
				
			}else{
				// 获取json文件内容
				if( !cPlugin('getFile') ){
					res.status(404).json({
						message:"错误！接口不可用"
					});
					return;
				}
					
				try	{
					// 读取json文件
					let jsonStr = fs.readFileSync(path.resolve(dataDirPath, jsonPath + '.json'), 'utf8')
					// elog( jsonStr )
					let fileJSON = JSON.parse(jsonStr);
					tOps = {}
					// 读取json文件中的设置
					// elog(fileJSON)
					if( fileJSON._settings ){
						// 覆盖全局设置
            assignDeep(tOps, ops, fileJSON._settings)
            // elog(tOps)
						// 获取插件设置
						tOps._usePlugins = checkOpsPlugins(tOps);
						// 读取后删除，防止在响应中出现
						delete fileJSON._settings;
					}else{
						assignDeep(tOps, ops)
					}

					let rsp = fileJSON;
					// 该请求的响应配置
					// elog(tOps)
					// elog(fileJSON)
					// 开始依次执行内置插件
					// 补列表结构
					cPlugin('acList', tOps) && (rsp = acList(fileJSON, tOps.plugins.acList, req))
					// 补基本结构
					cPlugin('acStructure', tOps) && (rsp = acStructure(rsp))
					// 返回查询对象
					cPlugin('acQuery', tOps) && (rsp._query = req.query)
					// 替换占位符
					cPlugin('placeHolder', tOps) && (rsp = placeHolder(rsp))
					// elog( rsp )
					setTimeout(function(){
						res.status(200).json(rsp);
					},tOps.delay)
					
				}catch(err){
					throw err
					res.status(403).json({
						success:false,
						message:"错误！接口文件解析出错，" + err
					})
					
				}
				
			}
			
		}
		
	});
}
