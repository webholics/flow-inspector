#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Import IPFIX flows from MySQL or PostgreSQL Vermont format
into the Redis buffer for preprocessing

Author: Mario Volke
"""

import sys
import math
import time
import argparse
import datetime
import redis
import json
import psycopg2
import MySQLdb
import _mysql_exceptions

IGNORE_COLUMNS = ["firstSwitchedMillis", "lastSwitchedMillis"]

# width defines bar width
# percent defines current percentage
def progress(width, percent):
	marks = math.floor(width * (percent / 100.0))
	spaces = math.floor(width - marks)
 
 	loader = '[' + ('=' * int(marks)) + (' ' * int(spaces)) + ']'
 
	sys.stdout.write("%s %d%%\r" % (loader, percent))
	if percent >= 100:
		sys.stdout.write("\n")
	sys.stdout.flush()

parser = argparse.ArgumentParser(description="Import IPFIX flows from MySQL or PostgreSQL Vermont format into the Redis buffer for preprocessing")
parser.add_argument("--src-host", nargs="?", default="127.0.0.1", help="MySQL or PostgreSQL host")
parser.add_argument("--src-port", nargs="?", type=int, help="MySQL or PostgreSQL port")
parser.add_argument("--src-user", nargs="?", default="root", help="MySQL or PostgreSQL user")
parser.add_argument("--src-password", nargs="?", default="", help="MySQL or PostgreSQL password")
parser.add_argument("--src-database", nargs="?", default="flows", help="MySQL or PostgreSQL database name")
parser.add_argument("--dst-host", nargs="?", default="127.0.0.1", help="Redis host")
parser.add_argument("--dst-port", nargs="?", default=6379, type=int, help="Redis port")
parser.add_argument("--dst-database", nargs="?", default=0, type=int, help="Redis database")
parser.add_argument("--max-queue", nargs="?", type=int, default=100000, help="The maximum queue length before the import will sleep.")
parser.add_argument("--clear-queue", nargs="?", type=bool, default=False, const=True, help="Whether to clear the queue before importing the flows.")

args = parser.parse_args()

REDIS_QUEUE_KEY = "entry:queue"

# check if is there a MySQL or a PostgreSQL database
try:
	TYPE = "postgresql"
	dns = dict(
		database = args.src_database, 
		host = args.src_host,
		user = args.src_user,
		password = args.src_password
	)
	if args.src_port is not None:
		dns.port = args.src_port
	conn = psycopg2.connect(**dns)
except psycopg2.OperationalError, e:
	try:
		TYPE = "mysql"
		dns = dict(
			db = args.src_database, 
			host = args.src_host,
			user = args.src_user,
			passwd = args.src_password
		)
		if args.src_port is not None:
			dns.port = args.src_port
		conn = MySQLdb.connect(**dns)
	except _mysql_exceptions.OperationalError, e:
		print >> sys.stderr, "Could not connect to source database!"
		sys.exit(1)

try:
	r = redis.StrictRedis(host=args.dst_host, port=args.dst_port, db=args.dst_database)
except e:
	print >> sys.stderr, "Could not connect to Redis database!"
	sys.exit(1)
	
if args.clear_queue:
	r.delete(REDIS_QUEUE_KEY)
	
c = conn.cursor()

startTime = datetime.datetime.now()
print "%s: connected to source and destination database" % (startTime)

# get all flow tables
c.execute("""SELECT table_name from information_schema.tables 
	WHERE table_schema=%s AND table_type='BASE TABLE' AND table_name LIKE 'h\\_%%' ORDER BY table_name ASC""", 
	(args.src_database))
tables = c.fetchall()

# THIS IS MYSQL SPECIFIC
#c.execute("SHOW TABLES LIKE 'h\\_%'")
#tables = c.fetchall()

count = 0
for i, table in enumerate(tables):
	progress(100, i/len(tables)*100)
	
	c.execute("SELECT * FROM " + table[0] + " ORDER BY firstSwitched ASC")
	
	for row in c:
		obj = dict()
		for j, col in enumerate(c.description):
			if col[0] not in IGNORE_COLUMNS:
				obj[col[0]] = row[j]
		
		queue_length = r.rpush(REDIS_QUEUE_KEY, json.dumps(obj))
		while queue_length > args.max_queue:
			print "Max queue length reached, importing paused..."
			time.sleep(10)
			queue_length = r.llen(REDIS_QUEUE_KEY)
			
		count += 1

progress(100, 100)

# Append termination flag to queue
# The preprocessing daemon will terminate with this flag.
r.rpush(REDIS_QUEUE_KEY, "END")

endTime = datetime.datetime.now()
print "%s: imported %i flows in %s" % (endTime, count, endTime - startTime)

c.close()
conn.close()