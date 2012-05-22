#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Flow Inspector - Visual Network Flow Analyis

Author: Mario Volke
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'vendor'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'config'))

import math
import bson
import pymongo
import config

from bottle import TEMPLATE_PATH, HTTPError, get, run, debug, request, validate, static_file, error
from bottle import jinja2_view as view, jinja2_template as template

# the collection prefix to use for flows
DB_FLOW_PREFIX = "flows_"
# the collection prefix to use for completely aggregated flows
DB_FLOW_AGGR_PREFIX = "flows_aggr_"
# the collection to use for the node index
DB_INDEX_NODES = "index_nodes"
# the collection to use for the port index
DB_INDEX_PORTS = "index_ports"
# column names of IP addresses
COL_SRC_IP = "srcIP"
COL_DST_IP = "dstIP"
# column names of ports
COL_SRC_PORT = "srcPort"
COL_DST_PORT = "dstPort"

# set template path
TEMPLATE_PATH.insert(0, os.path.join(os.path.dirname(__file__), "views"))

# MongoDB
db = pymongo.Connection(config.db_host, config.db_port)[config.db_name]

def get_bucket_size(start_time, end_time, resolution):
	for i,s in enumerate(config.flow_bucket_sizes):
		if i == len(config.flow_bucket_sizes)-1:
			return s
			
		coll = db[DB_FLOW_AGGR_PREFIX + str(s)]
		min_bucket = coll.find_one(
			{ "bucket": { "$gte": start_time, "$lte": end_time} }, 
			fields={ "bucket": 1, "_id": 0 }, 
			sort=[("bucket", pymongo.ASCENDING)])
		max_bucket = coll.find_one(
			{ "bucket": { "$gte": start_time, "$lte": end_time} }, 
			fields={ "bucket": 1, "_id": 0 }, 
			sort=[("bucket", pymongo.DESCENDING)])
			
		if not min_bucket or not max_bucket:
			return s
			
		num_slots = (max_bucket["bucket"]-min_bucket["bucket"]) / s + 1
		if num_slots <= resolution:
			return s
		
@get("/")
@get("/graph")
@get("/graph/:##")
@get("/hierarchical-edge-bundle")
@get("/hierarchical-edge-bundle/:##")
@get("/hive-plot")
@get("/hive-plot/:##")
@view("index")
def index():
    # find js files
    include_js = []
    path = os.path.join(os.path.dirname(__file__), "static", "js", "dev")
    for dirname, dirnames, filenames in os.walk(path):
        dirnames.sort(reverse=True)
        filenames.sort(reverse=True)
        for filename in filenames:
            if not filename.startswith(".") and filename.endswith(".js"):
                include_js.insert(0, dirname[len(os.path.dirname(__file__)):] + "/" + filename)

    # find frontend templates
    frontend_templates = []
    path = os.path.join(os.path.dirname(__file__), "views", "frontend")
    for filename in os.listdir(path):
        if not filename.startswith(".") and filename.endswith(".tpl"):
            frontend_templates.append(os.path.join("frontend", filename))

    return dict(
        include_js = include_js,
        frontend_templates = frontend_templates)

@get("/api/bucket/query")
@get("/api/bucket/query/")
def api_bucket_query():
	# get query params
	start_bucket = 0
	if "start_bucket" in request.GET:
		try:
			start_bucket = int(request.GET["start_bucket"])
		except ValueError:
			raise HTTPError(output="Param start_bucket has to be an integer.")
		
		if start_bucket < 0:
			start_bucket = 0
	
	end_bucket = sys.maxint
	if "end_bucket" in request.GET:
		try:
			end_bucket = int(request.GET["end_bucket"])
		except ValueError:
			raise HTTPError(output="Param end_bucket has to be an integer.")
		
		if end_bucket < 0:
			end_bucket = 0
	
	# the bucket resolution to query (number of buckets)		
	resolution = 1
	if "resolution" in request.GET:
		try:
			resolution = int(request.GET["resolution"])
		except ValueError:
			raise HTTPError(output="Param resolution has to be an integer.")
		
		if resolution < 1:
			resolution = 1
			
	# or set the bucket size directly
	bucket_size = None
	if "bucket_size" in request.GET:
		try:
			bucket_size = int(request.GET["bucket_size"])
		except ValueError:
			raise HTTPError(output="Param bucket_size has to be an integer.")
			
		if bucket_size not in config.flow_bucket_sizes:
			raise HTTPError(output="This bucket size is not available.")
			
	# biflow aggregation
	# This simply removes the difference between srcIP and dstIP
	# (The smaller ip will always be the srcIP)
	biflow = False
	if "biflow" in request.GET:
		biflow = True
		
	# only stated fields will be available, all others will be aggregated toghether	
	fields = []
	if "fields" in request.GET:
		fields = request.GET["fields"].strip()
		fields = map(lambda v: v.strip(), fields.split(","))
		# filter for known aggregation values
		fields = [v for v in fields if v in config.flow_aggr_values]
		
	# port filter
	include_ports = []
	if "include_ports" in request.GET:
		include_ports = request.GET["include_ports"].strip()
		try:
			include_ports = map(lambda v: int(v.strip()), include_ports.split(","))
		except ValueError:
			raise HTTPError(output="Ports have to be integers.")
			
	exclude_ports = []
	if "exclude_ports" in request.GET:
		exclude_ports = request.GET["exclude_ports"].strip()
		try:
			exclude_ports = map(lambda v: int(v.strip()), exclude_ports.split(","))
		except ValueError:
			raise HTTPError(output="Ports have to be integers.")
		
	# get buckets and aggregate
	if bucket_size == None:
		bucket_size = get_bucket_size(start_bucket, end_bucket, resolution)
	
	if len(fields) > 0 or len(include_ports) > 0 or len(exclude_ports) > 0:
		collection = db[DB_FLOW_PREFIX + str(bucket_size)]
	else:
		# use preaggregated collection
		collection = db[DB_FLOW_AGGR_PREFIX + str(bucket_size)]
		
	spec = {}
	if start_bucket > 0 or end_bucket < sys.maxint:
		spec["bucket"] = {}
		if start_bucket > 0:
			spec["bucket"]["$gte"] = start_bucket
		if end_bucket < sys.maxint:
			spec["bucket"]["$lte"] = end_bucket
	if len(include_ports) > 0:
		spec["$or"] = [
			{ COL_SRC_PORT: { "$in": include_ports } },
			{ COL_DST_PORT: { "$in": include_ports } }
		]
	if len(exclude_ports) > 0:
		spec[COL_SRC_PORT] = { "$nin": exclude_ports }
		spec[COL_DST_PORT] = { "$nin": exclude_ports }
	
	query_fields = fields + ["bucket", "flows"] + config.flow_aggr_sums
	cursor = collection.find(spec, fields=query_fields).sort("bucket", pymongo.ASCENDING).batch_size(1000)

	buckets = []
	if len(fields) > 0 or len(include_ports) > 0 or len(exclude_ports) > 0:
		current_bucket = -1
		aggr_buckets = {}
		for doc in cursor:
			if doc["bucket"] > current_bucket:
				for key in aggr_buckets:
					buckets.append(aggr_buckets[key])
				aggr_buckets = {}
				current_bucket = doc["bucket"]
				
			# biflow?
			if biflow and COL_SRC_IP in fields and COL_DST_IP in fields:
				srcIP = doc.get(COL_SRC_IP, None)
				dstIP = doc.get(COL_DST_IP, None)
				if srcIP > dstIP:
					doc[COL_SRC_IP] = dstIP
					doc[COL_DST_IP] = srcIP
			
			# construct aggregation key
			key = str(current_bucket)
			for a in fields:
				key += str(doc.get(a, "x"))
				
			if key not in aggr_buckets:
				bucket = { "bucket": current_bucket }
				for a in fields:
					bucket[a] = doc.get(a, None)
				for s in ["flows"] + config.flow_aggr_sums:
					bucket[s] = 0
				aggr_buckets[key] = bucket
			else:
				bucket = aggr_buckets[key]
			
			for s in ["flows"] + config.flow_aggr_sums:
				bucket[s] += doc.get(s, 0)
			
		for key in aggr_buckets:
			buckets.append(aggr_buckets[key])
	else:
		# cheap operation if nothing has to be aggregated
		for doc in cursor:
			del doc["_id"]
			buckets.append(doc)
	
	return { 
		"bucket_size": bucket_size,
		"results": buckets
	}
	
@get("/api/index/:name")
@get("/api/index/:name/")
def api_index(name):
	# construct query
	limit = 0
	if "limit" in request.GET:
		try:
			limit = int(request.GET["limit"])
		except ValueError:
			raise HTTPError(output="Param limit has to be an integer.")
		
		if limit < 0:
			limit = 0
			
	fields = None
	if "fields" in request.GET:
		fields = request.GET["fields"].strip()
		fields = map(lambda v: v.strip(), fields.split(","))
		
	sort = None
	if "sort" in request.GET:
		sort = request.GET["sort"].strip()
		sort = map(lambda v: v.strip(), sort.split(","))
		for i in range(0, len(sort)):
			field = sort[i].split(" ")
			order = pymongo.ASCENDING
			if field[-1].lower() == "asc":
				field.pop()
			elif field[-1].lower() == "desc":
				order = pymongo.DESCENDING
				field.pop()
			
			field = " ".join(field)
			sort[i] = (field, order)
			
	count = False
	if "count" in request.GET:
		count = True
	
	collection = None
	if name == "nodes":
		collection = db[DB_INDEX_NODES]
	elif name == "ports":
		collection = db[DB_INDEX_PORTS]
		
	if collection == None:
		raise HTTPError(404, "Index name not known.")
		
	cursor = collection.find(fields=fields).batch_size(1000)
	if sort:
		cursor.sort(sort)
	if limit:
		cursor.limit(limit)
		
	if count:
		result = cursor.count() 
	else:
		result = []
		for row in cursor:
			row["id"] = row["_id"]
			del row["_id"]
			result.append(row)
	
	return { "results": result }

@get("/static/:path#.+#")
def server_static(path):
	return static_file(path, root=os.path.join(os.path.dirname(__file__), "static"))

if __name__ == "__main__":
	debug(config.debug)
	run(host=config.host, port=config.port, reloader=config.debug)