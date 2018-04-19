var {elog} = require('uojo-kit');
var express = require('express');
var dataServer = require("../src/index");

var app = express()

dataServer(app,{
	reqPath: 'data',
	dataPath: './api',
	basePath: __dirname,
	debug:true,
})

var bs = require('browser-sync').create();
var port = 3000, _port = port-1;
app.listen(_port, function(err) {
	if (err) {
		elog(err)
		return
	}
	
	// 访问代理服务，文件变更后触发浏览器刷新
	bs.init({
		open: false,
		ui: false,
		notify: false,
		logLevel:"silent",
		proxy: '127.0.0.1:'+ _port,
		watchOptions:{
			ignoreInitial: true,
			// ignored: '*.txt'
		},
		files: [
			{
				match:['./src/**','./**'],
				fn:function(e, e_path){
					bs.reload();
				}
			}
		],
		port: port
	});
	
	var uri = '127.0.0.1:3000'
	elog('Listening at ' + uri + '\n')

})