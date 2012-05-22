#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Preprocess flows taken from Redis queue.
Keep this script running forever if you want live data:
nohup ./preprocess.py

It is save to run multiple instances of this script!

Author: Mario Volke
"""

import sys
import os.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'config'))

import math
import time
import threading
import argparse
import datetime
import redis
import json
import pymongo
import bson
import xml.dom.minidom
from collections import deque

import config

parser = argparse.ArgumentParser(description="Import IPFIX flows from MySQL or PostgreSQL Vermont format into MongoDB.")
parser.add_argument("--src-host", nargs="?", default="127.0.0.1", help="Redis host")
parser.add_argument("--src-port", nargs="?", default=6379, type=int, help="Redis port")
parser.add_argument("--src-database", nargs="?", default=0, type=int, help="Redis database")
parser.add_argument("--dst-host", nargs="?", default=config.db_host, help="MongoDB host")
parser.add_argument("--dst-port", nargs="?", default=config.db_port, type=int, help="MongoDB port")
parser.add_argument("--dst-database", nargs="?", default=config.db_name, help="MongoDB database name")
parser.add_argument("--clear-database", nargs="?", type=bool, default=False, const=True, help="Whether to clear the whole databse before importing any flows.")

args = parser.parse_args()

# Print output every ... in seconds
OUTPUT_INTERVAL = 10

# flow time interval column names
COL_FIRST_SWITCHED = "firstSwitched"
COL_LAST_SWITCHED = "lastSwitched"
# column names of IP addresses
COL_SRC_IP = "srcIP"
COL_DST_IP = "dstIP"
# column names of ports and protocol
COL_SRC_PORT = "srcPort"
COL_DST_PORT = "dstPort"
COL_PROTO = "proto"

# the collection prefix to use for flows
DB_FLOW_PREFIX = "flows_"
# the collection prefix to use for completely aggregated flows
DB_FLOW_AGGR_PREFIX = "flows_aggr_"
# the collection to use for the node index
DB_INDEX_NODES = "index_nodes"
# the collection to use for the port index
DB_INDEX_PORTS = "index_ports"

# the xml file containing known port numbers
PORTS_FILE = os.path.join(os.path.dirname(__file__), '..', 'config', 'service-names-port-numbers.xml')

REDIS_QUEUE_KEY = "entry:queue"
	
# Class to handle flows
class FlowHandler:
	def __init__(self, bucket_interval, collection, aggr_sum, aggr_values=[], filter_ports=None, cache_size=0):
		"""
		:Parameters:
		 - `bucket_interval`: The bucket interval in seconds.
		 - `collection`: A pymongo collection to insert the documents.
		 - `aggr_sum`: A list of keys which will be sliced and summed up.
		 - `aggr_values`: A list of keys which have to match in order to aggregate two flows
		 - `filter_ports`: A dictionary of ports and protocols to remove unknown ports
		"""
		self.bucket_interval = bucket_interval
		self.collection = collection
		self.aggr_sum = aggr_sum
		self.aggr_values = aggr_values
		self.filter_ports = filter_ports
		
		# init cache
		self.cache = None
		self.cache_size = cache_size
		if cache_size > 0:
			self.cache = dict()
			self.cache_queue = deque()
			
		# stats
		self.num_flows = 0
		self.num_slices = 0
		self.cache_hits = 0
		self.cache_misses = 0
		self.db_requests = 0
		
	def get_id(self, bucket, flow):
		"""Generate a unique id.
		"""
		id = str(bucket)
		for i,col in enumerate(self.aggr_values):
			id += str(flow.get(col, "x"))
		return id
	
	def get_bucket(self, timestamp, interval):
		"""Compute the bucket timestamp.
		"""
		return int(timestamp) / int(interval) * int(interval)
	
	def handleFlow(self, flow):
		"""Slice a flow from the queue into buckets and insert into MongoDB.
		"""
		
		self.num_flows += 1
		
		carry = dict();
		emitted = dict();
		for s in self.aggr_sum:
			carry[s] = 0
			emitted[s] = 0
		bucket = self.get_bucket(flow[COL_FIRST_SWITCHED], self.bucket_interval)
		while bucket <= flow[COL_LAST_SWITCHED]:
		
			self.num_slices += 1
		
			nextBucket = bucket + self.bucket_interval;
			bucketStart = bucket
			if bucketStart < flow[COL_FIRST_SWITCHED]:
				bucketStart = flow[COL_FIRST_SWITCHED]
			bucketEnd = nextBucket - 1
			if bucketEnd > flow[COL_LAST_SWITCHED]:
				bucketEnd = flow[COL_LAST_SWITCHED]
			intervalFactor = (bucketEnd - bucketStart + 1) / float(flow[COL_LAST_SWITCHED] - flow[COL_FIRST_SWITCHED] + 1)
			
			key = self.get_id(bucket, flow)	
			
			# check if we hit the cache
			doc = None
			if self.cache != None:
				doc = self.cache.get(key, None)
				if doc == None:
					self.cache_misses += 1
				else:
					self.cache_hits += 1
			if doc == None:
				doc = { "$set": { "bucket": bucket }, "$inc": {} }
			
				# set unknown ports to None
				if self.filter_ports:
					for v in self.aggr_values:
						if v == COL_SRC_PORT or v == COL_DST_PORT:
							set_value = None
							value = flow.get(v, None)
							if value != None and value in self.filter_ports:
								proto = int(flow.get(COL_PROTO, -1))
								if proto == -1 or proto in self.filter_ports[value]:
									set_value = value
							doc["$set"][v] = set_value
						else:
							doc["$set"][v] = flow.get(v, None)
				else:
					for v in self.aggr_values:
						doc["$set"][v] = flow.get(v, None)
						
				for s in self.aggr_sum:
					doc["$inc"][s] = 0
				doc["$inc"]["flows"] = 0
				
				if self.cache != None:
					# insert into cache
					self.cache[key] = doc
					self.cache_queue.append(key)
			
			if nextBucket > flow[COL_LAST_SWITCHED]:
				for s in self.aggr_sum:
					assert flow.get(s, 0) - emitted[s] >= 0
					doc["$inc"][s] += flow.get(s, 0) - emitted[s]
			else:
				for s in self.aggr_sum:
					interval = intervalFactor * flow.get(s, 0)
					num = carry[s] + interval
					val = int(num)
					carry[s] = num - val;
					emitted[s] += val
					doc["$inc"][s] += val
					
			# count number of aggregated flows in the bucket
			doc["$inc"]["flows"] += intervalFactor
			
			# if caching is actived then insert into cache
			if self.cache != None:
				self.handleCache()
			else:
				self.updateCollection(key, doc)
				
			bucket = nextBucket
			
	def updateCollection(self, key, doc):
		# bindata will reduce id size by 50%
		self.collection.update({ "_id": bson.binary.Binary(key) }, doc, True)
		self.db_requests += 1
		
	def handleCache(self, clear=False):
		if not self.cache:
			return
			
		while (clear and len(self.cache_queue) > 0) or len(self.cache_queue) > self.cache_size:
			key = self.cache_queue.popleft()
			doc = self.cache[key]
			self.updateCollection(key, doc)
			del self.cache[key]
			
	def printReport(self):
		print "%s report:" % (self.collection.name)
		print "-----------------------------------"
		print "Flows processed: %i" % (self.num_flows)
		print "Slices overall: %i (avg. %.2f per flow)" % (self.num_slices, self.num_slices / float(self.num_flows))
		print "Database requests: %i" % (self.db_requests)
		
		if self.cache != None:
			print "Cache hit ratio: %.2f%%" % (self.cache_hits / float(self.cache_hits + self.cache_misses) * 100)
		else:
			print "Cache deactivated"
			
		print ""
		
def update_node_index(obj, collection, aggr_sum):
	"""Update the node index collection in MongoDB with the current flow.
	
	:Parameters:
	 - `obj`: A dictionary containing a flow.
	 - `collection`: A pymongo collection to insert the documents.
	 - `aggr_sum`: A list of keys which will be sliced and summed up.
	"""
	
	# update source node
	doc = { "$inc": {} }
	
	for s in aggr_sum:
		doc["$inc"][s] = obj.get(s, 0)
		doc["$inc"]["src." + s] = obj.get(s, 0)
	doc["$inc"]["flows"] = 1
	doc["$inc"]["src.flows"] = 1
	
	# insert if not exists, else update sums
	collection.update({ "_id": obj[COL_SRC_IP] }, doc, True)
	
	# update destination node
	doc = { "$inc": {} }
	
	for s in aggr_sum:
		doc["$inc"][s] = obj.get(s, 0)
		doc["$inc"]["dst." + s] = obj.get(s, 0)
	doc["$inc"]["flows"] = 1
	doc["$inc"]["dst.flows"] = 1
	
	# insert if not exists, else update sums
	collection.update({ "_id": obj[COL_DST_IP] }, doc, True)
	
def update_port_index(obj, collection, aggr_sum, filter_ports):
	"""Update the port index collection in MongoDB with the current flow.
	
	:Parameters:
	 - `obj`: A dictionary containing a flow.
	 - `collection`: A pymongo collection to insert the documents.
	 - `aggr_sum`: A list of keys which will be sliced and summed up.
	 - `filter_ports`: A dictionary of ports and protocols to remove unknown ports
	"""
	
	# update source port
	doc = { "$inc": {} }
	
	for s in aggr_sum:
		doc["$inc"][s] = obj.get(s, 0)
		doc["$inc"]["src." + s] = obj.get(s, 0)
	doc["$inc"]["flows"] = 1
	doc["$inc"]["src.flows"] = 1
	
	# set unknown ports to None
	port = obj.get(COL_SRC_PORT, None)
	if filter_ports and port != None:
		if port in filter_ports:
			proto = int(obj.get(COL_PROTO, -1))
			if proto >= 0 and not proto in filter_ports[port]:
				port = None
		else:
			port = None
	
	# insert if not exists, else update sums
	collection.update({ "_id": port }, doc, True)
	
	# update destination port
	doc = { "$inc": {} }
	
	for s in aggr_sum:
		doc["$inc"][s] = obj.get(s, 0)
		doc["$inc"]["dst." + s] = obj.get(s, 0)
	doc["$inc"]["flows"] = 1
	doc["$inc"]["dst.flows"] = 1
	
	# set unknown ports to None
	port = obj.get(COL_DST_PORT, None)
	if filter_ports and port != None:
		if port in filter_ports:
			proto = int(obj.get(COL_PROTO, -1))
			if proto >= 0 and not proto in filter_ports[port]:
				port = None
		else:
			port = None
	
	# insert if not exists, else update sums
	collection.update({ "_id": port }, doc, True)

output_flows = 0
def print_output():
	global OUTPUT_INTERVAL, output_flows, timer
	print "%s: Processed %i flows within last %i seconds (%.2f flows/s)." % (
		datetime.datetime.now(), output_flows, OUTPUT_INTERVAL, output_flows / float(OUTPUT_INTERVAL))
	output_flows = 0
	timer = threading.Timer(OUTPUT_INTERVAL, print_output)
	timer.start()
	
print "%s: Init..." % (datetime.datetime.now())

# init redis connection
try:
	r = redis.StrictRedis(host=args.src_host, port=args.src_port, db=args.src_database)
except Exception, e:
	print >> sys.stderr, "Could not connect to Redis database: %s" % (e)
	sys.exit(1)

# init pymongo connection
try:
	dst_conn = pymongo.Connection(args.dst_host, args.dst_port)
except pymongo.errors.AutoReconnect, e:
	print >> sys.stderr, "Could not connect to MongoDB database!"
	sys.exit(1)
	
if args.clear_database:
	dst_conn.drop_database(args.dst_database)
	
dst_db = dst_conn[args.dst_database]
node_index_collection = dst_db[DB_INDEX_NODES]
port_index_collection = dst_db[DB_INDEX_PORTS]
	
# read ports for special filtering
known_ports = None
if config.flow_filter_unknown_ports:
	f = open(PORTS_FILE, "r")
	dom = xml.dom.minidom.parse(f)
	f.close()
	
	def getDomText(node):
		rc = []
		for n in node.childNodes:
			if n.nodeType == node.TEXT_NODE:
				rc.append(n.data)
		return ''.join(rc)

	known_ports = dict()
	records = dom.getElementsByTagName("record")
	for record in records:
		description = getDomText(record.getElementsByTagName("description")[0])
		number = record.getElementsByTagName("number")
		if description != "Unassigned" and len(number) > 0:
			numbers = getDomText(number[0]).split('-')
			number = int(numbers[0])
			number_to = int(numbers[len(numbers)-1])
			
			protocol = record.getElementsByTagName("protocol")
			if len(protocol) > 0:
				protocol = getDomText(protocol[0])
				if protocol == "tcp":
					protocol = 6
				elif protocol == "udp":
					protocol = 17
				else:
					protocol = 0
			else:
				protocol = 0
			
			while number <= number_to:
				if number in known_ports:
					known_ports[number].append(protocol)
				else:
					known_ports[number] = [protocol]
				number += 1

# create flow handlers
handlers = []
for s in config.flow_bucket_sizes:
	handlers.append(FlowHandler(
		s,
		dst_db[DB_FLOW_PREFIX + str(s)],
		config.flow_aggr_sums,
		config.flow_aggr_values,
		known_ports,
		config.pre_cache_size
	))
for s in config.flow_bucket_sizes:
	handlers.append(FlowHandler(
		s,
		dst_db[DB_FLOW_AGGR_PREFIX + str(s)],
		config.flow_aggr_sums,
		[],
		None,
		config.pre_cache_size_aggr
	))

# create indexes
for handler in handlers:
	handler.collection.create_index("bucket")

print "%s: Preprocessing started." % (datetime.datetime.now())
print "%s: Use Ctrl-C to quit." % (datetime.datetime.now())

timer = threading.Timer(OUTPUT_INTERVAL, print_output)
timer.start()

# Daemon loop
while True:
	try:
		# this redis call blocks until there is a new entry in the queue
		obj = r.blpop(REDIS_QUEUE_KEY, 0)
		obj = obj[1]
		
		# Terminate if this object is the END flag
		if obj == "END":
			print "%s: Reached END. Terminating..." % (datetime.datetime.now())
			break
			
		try:
			obj = json.loads(obj)
			obj[COL_FIRST_SWITCHED] = int(obj[COL_FIRST_SWITCHED])
			obj[COL_LAST_SWITCHED] = int(obj[COL_LAST_SWITCHED])
			for s in config.flow_aggr_sums:
				obj[s] = int(obj[s])
		except ValueError, e:
			print >> sys.stderr, "Could not decode JSON object in queue!"
			continue
	
		# Bucket slicing
		for handler in handlers:
			handler.handleFlow(obj)
			
		update_node_index(obj, node_index_collection, config.flow_aggr_sums)
		update_port_index(obj, port_index_collection, config.flow_aggr_sums, known_ports)
			
		output_flows += 1
		
	except KeyboardInterrupt:
		print "%s: Keyboard interrupt. Terminating..." % (datetime.datetime.now())
		break
		
timer.cancel()

# clear cache
for handler in handlers:
	handler.handleCache(True)
# print reports
print ""
for handler in handlers:
	handler.printReport()