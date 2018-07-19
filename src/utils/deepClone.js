var cloneDeep = function (obj, white) {
  // console.info( white );
  // var self = this.cloneObj;
  var o
  // console.log(this);
  // console.info( obj.constructor, obj.valueOf() );
  // console.info( obj.constructor, obj.valueOf() );

  if (obj.constructor === Object || obj.constructor === Array) {
    o = new obj.constructor()
  } else {
    // console.info( obj.valueOf() );
    o = new obj.constructor(obj.valueOf())
  }

  for (var key in obj) {
    // console.info( o[key] != obj[key], key, obj[key] );

    // 通过白名单过滤对象【默认不过滤】
    if (white && !white[key] && obj.constructor !== Array) break

    if (o[key] !== obj[key]) {
      if (typeof (obj[key]) === 'object') {
        // console.log( "-Object or Array" );

        o[key] = cloneDeep(obj[key], white)
      } else {
        o[key] = obj[key]
      }
    }
  }

  return o
}
module.exports = cloneDeep
