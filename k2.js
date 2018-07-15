var log=console.log
var argv=require('optimist').argv;
var chalk=require('chalk');
var yy=chalk.bgYellow;
var rr=chalk.bgRed;
var _=require('lodash');

var cfg={
	user:'system',
	password:'oracle'
}

var path=require('path')
var express=require('express')
var app=express()
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port=8778
http.listen(port)

io.on('connection', function(socket){
	socket.on('exec', function(sql_id){
		log(yy('exec sql_id',sql_id));

		exec(cfg, sql_id, function(err,ret){
			log(ret)
			socket.emit('data', ret);
		});
	})
	socket.on('execSQL', function(sql){
		log(yy('exec sql',sql));

		exec(cfg, 'manual', function(err,ret){
			log(ret)
			socket.emit('data', ret);
		}, sql);
	})
});

var resultSet=true;

oracledb=require('oracledb')
oracledb.resultSet=resultSet;
oracledb.extendedMetaData=true;
oracledb.autoCommit=true;


app.get('/', function(req,res){
	res.render('main.jade',{values:_.keys(sqls)})
});

app.get('/cdn/:file', function(req,res){
	res.sendfile(path.join(__dirname,'cdn',req.params.file));
});

app.get('/files/:file*', function(req,res){
	var file=path.join(__dirname,req.params.file,req.params[0]);
	res.sendfile(file);
});

var sqls={
	default:'select * from all_tables',
	err:'select * from hr,test where name=3',
	nls:`select userenv('language') from dual`,
	objects:`select owner, t.* from all_objects t where rownum<=3`,
	inact:`select count(1) cnt from gv$session where status='INACTIVE'`,
	inact2:`select count(1) cnt from gv$session where status=:status`,

	objects:'select * from all_objects where rownum<3',
	get_ddl:`select dbms_metadata.get_ddl('TABLE','TEST','OBJECT_OWNER') from dual`,
	create:'create table test as select 1 no, cast(null as varchar2(64)) name from dual',
	create1:'create table hr as select 1 no, cast(null as varchar2(64)) name, cast(null as varchar2(64)) tel from dual',
	alter:`alter table test add ( dt date )`,
	insert:`begin insert into test(dt)values(sysdate);commit;end;`, 
	insert1:`begin insert into no(1,123)values(sysdate);commit;end;`, 
	select2:'select * from test, hr',
	select_count:'select count(1) from test',
	select:'select * from test',
	xinsert:`insert into test(dt)values(sysdate)` 
}

var params={
	inact2:{status:'INACTIVE'}
}

var fetchInfo={
	HIRE_DATE:    { type : oracledb.STRING },  // return the date as a string
	HIRE_DETAILS: { type : oracledb.DEFAULT },  // override fetchAsString or fetchAsBuffer
	OWNER:{type:oracledb.BUFFER}
}

app.get('/sql_id/:sql_id', function(req,res){
	exec(cfg, req.params.sql_id, function(err,ret){
		if (err) return res.send(err)
		res.send(ret);
	});
});

function exec(cfg, sql_id, cb, sql) {
	var ret={sql_id:sql_id, sql:sql};

	//oracledb.createPool(cfg, function(err,pool){
		oracledb.getConnection(cfg, function(err,x){
			connection=x;
							
			if (!ret.sql) ret.sql=sqls[sql_id]
			var param=params[sql_id]||{};

			connection.getStatementInfo(ret.sql, function(err, info){
				if (err) ret.err='info:'+err.message;
				ret.info=info;
				if (err) return cb(null, ret); 

				var show_detail=info.statementType==oracledb.STMT_TYPE_SELECT
				log('sql',ret.sql);

				connection.execute(ret.sql, function(err2,result){
				if (err2) ret.err='execute:'+err2.message;
				ret.result=result;
				if (err2) return cb(null, ret); 

				if (show_detail && ret.resultSet){
					log('show_detail');
					ret.resultSet.getRows(3, show('getrows'));
					return cb(err2,ret);
					//else io.emit(data, {err2:err, ret:ret});
				}
				else cb(null, ret);
			})
		})
	//})

	function show(s){
		return function(err, ret){
			if (cb) return cb(err, ret)
			else io.emit('show',{err4:err, ret:ret});
			log('show@'+s);
			log('err',err);
			log('ret',ret);
		}
	}
}
