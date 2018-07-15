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

module.exports=sqls;
