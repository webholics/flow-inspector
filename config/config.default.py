# -*- coding: utf-8 -*-
# Copy this file to config.py and edit configs

# Server
#----------------------------------------------------------------
host = "0.0.0.0"
port = 8080
debug = True

# MongoDB
#----------------------------------------------------------------
db_host = "127.0.0.1"
db_port = 27017
db_name = "flows"

# Flow settings
#----------------------------------------------------------------
# The different bucket sizes in seconds to aggregate.
# Each bucket size leads to a new collection in the database.
# This list is assumed be sorted ascending!
flow_bucket_sizes = [60, 10*60, 60*60, 24*60*60]
# Those values have to match in order to aggregate two flows
flow_aggr_values = ["srcIP", "dstIP", "srcPort", "dstPort"]
# Those columns will be summed up
flow_aggr_sums = ["pkts", "bytes"]
# Special treatment for ports:
# Only consider known port numbers, set the others to null
# before aggregation.
flow_filter_unknown_ports = True

# Preprocessor settings
#----------------------------------------------------------------
# caching can reduce the amount of writes to Mongo
# cache size per bucket size
pre_cache_size = 10000
# cache size for aggregated collections per bucket size
pre_cache_size_aggr = 5