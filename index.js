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
	let index=0;
	// elog(data.results.items.length)
	mapDeep(data,(val,key,parent)=>{
		// elog(val)
		if( typeof val === 'string' ){
			if(val==='{random}'){
				parent[key] = GetRandomNum(100,200);
			}
			
			if(val==='{times}'){
				parent[key] = Date.now();
			}
			
			if(val==='{id}'){
				// elog(parent)
				// index++
				var startIndex = 0;
				if(data.results && data.results.pageBean){
					startIndex = (data.results.pageBean.pageNo-1) * data.results.pageBean.pageSize;
				}
				parent[key] = startIndex+(++index);
			}
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

function acStructure(obj){
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

function acList(fileData, {noPageBean, queryFields, totalCount}, req){
	// elog(noPageBean)
	// 补全基本结构
	if( !noPageBean && fileData.items && fileData.items.length && !fileData.pageBean ){
		
		fileData.pageBean = {
			"pageNo": parseInt(req.query[queryFields.pageNo.name]) || queryFields.pageNo.value,
			"pageSize": parseInt(req.query[queryFields.size.name]) || queryFields.size.value,
			"totalCount": totalCount
		}
		
		// 判断 pageNo 的合法性
		if( fileData.pageBean.pageNo > Math.ceil( fileData.pageBean.totalCount/fileData.pageBean.pageSize) ){
			fileData.items= [];
		}
		
		let needCreate = (function(len,size){
			if(len>size){
				return 0;
			}
			let a = size%len, b = parseInt(size/len);
			// 少了补
			if(a>0){
				b++
			}
			return b;
		})(fileData.items.length,fileData.pageBean.pageSize)
		// elog(needCreate)
		if(needCreate){
			needCreate--;
			let oriData = cloneDeep(fileData.items);
			for(let i=0;i<needCreate;i++){
				fileData.items = fileData.items.concat( cloneDeep(oriData) )
			}
		}
		
		// 多了减
		fileData.items = fileData.items.slice(0,fileData.pageBean.pageSize)
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
		let defPs = ['fastMap','getFile','placeHolder','acStructure','acList','acQuery'];
		let ps = ops.plugins
		if( !ps ){
			ops.plugins = defPs;
			return ops;
		}
		
		let rlt = [];
		if( ps.constructor === Object ){
			for(i in defPs){
				let val = defPs[i];
				if( ps.hasOwnProperty(val) && !ps[val] ){
					
				}else{
					rlt.push(val)
				}
			}
		}else if( ps.constructor === Array){
			rlt = ps
		}
		// elog(rlt)
		ops.plugins = rlt;
		return ops;
	}
	checkOpsPlugins(options);
	
	// elog(options)
	let ops = assignDeep({
		bodyParser:true,
		debug:false,
    reqPath:"data",
    basePath: __dirname,
    dataPath:'api',
		fileMap:null,
		plugins:[],
		pluginsOptions:{
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
				noPageBean:false,
				totalCount:100 // [Number]，总记录数
			}
		}
		
	},options)
	
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
	
	app.use(`/${ops.reqPath}/*`,function(req,res,next){
		let jsonPath = getJsonPath(req);
		
		// 支持跨域
		setAllowOrigin(req);
		
		let ckrdt = ckRedirect(req, ops.fileMap)
		if( ckrdt.redirect ){
			res.redirect(ckrdt.newPath)
			return;
		}
		ckrdt.newPath && (jsonPath = ckrdt.newPath)
		// elog( jsonPath );
		// elog( req.query );
		let tOps=null;
		function cPlugin(name){
			let td = tOps?tOps:ops
			// elog(name,td)
			return td.plugins.includes(name);
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
			let ck_rlt = cPlugin('fastMap')? fastRoutes(jsonPath,req) :false;
			
			if( ck_rlt ){
				// elog(ck_rlt)
				cPlugin('acStructure') && (ck_rlt = acStructure(ck_rlt));
				res.status(200).json(ck_rlt);
				
			}else{
				// 获取数据文件内容
				if( !cPlugin('getFile') ){
					res.status(404).json({
						message:"错误！接口不可用"
					});
					return;
				}
					
				try	{
					// 读取JSON文件
					let jsonStr = fs.readFileSync(path.resolve(dataDirPath, jsonPath + '.json'), 'utf8')
					// elog( jsonStr )
					let rsp;
					let fileJSON = JSON.parse(jsonStr);
					tOps = {}
					if( fileJSON._settings ){
						assignDeep(tOps, ops, fileJSON._settings)
						checkOpsPlugins(tOps);
						delete fileJSON._settings;
					}else{
						assignDeep(tOps, ops)
					}
					elog(tOps)
					// 补列表结构
					cPlugin('acList') && (rsp = acList(fileJSON, tOps.pluginsOptions.acList, req))
					// 补基本结构
					cPlugin('acStructure') && (rsp = acStructure(rsp))
					// 返回查询对象
					cPlugin('acQuery') && (rsp._query = req.query)
					// 替换占位符
					cPlugin('placeHolder') && (rsp = placeHolder(rsp))
					// elog( rsp )
					res.status(200).json(rsp);
					
				}catch(err){
					// elog(err)
					res.status(403).json({
						success:false,
						message:"错误！接口文件解析出错，" + err
					})
					
				}
				
			}
			
		}
		
	});
}
