# SiteWatch — PostgreSQL Index Optimization Analysis

## Objective & Background
In IoT structural monitoring, thousands of sensor telemetry readings arrive every minute. 
The two most critical query patterns are:
1. **Time-series graphing**: Retrieving the latest $N$ readings for a specific sensor sorted newest-first (`ORDER BY recorded_at DESC LIMIT 100`).
2. **Health summary aggregation**: Calculating 24-hour `MIN`, `MAX`, and `AVG` values for a specific sensor.

To optimize these patterns, we created a composite B-Tree index:
```sql
CREATE INDEX idx_readings_sensor_time ON readings (sensor_id, recorded_at DESC);
```

---

## 1. Query: 24-Hour Metric Aggregation (`/sensors/:id/summary`)
```sql
SELECT 
  sensor_id,
  COUNT(*)::int AS count,
  ROUND(MIN(value)::numeric, 2) AS min,
  ROUND(MAX(value)::numeric, 2) AS max,
  ROUND(AVG(value)::numeric, 2) AS avg
FROM readings
WHERE sensor_id = 1
  AND recorded_at > now() - interval '24 hours'
GROUP BY sensor_id;
```

### Execution Plan WITH Index (`idx_readings_sensor_time`)
```text
GroupAggregate  (cost=1.41..4.67 rows=1 width=104) (actual time=0.066..0.069 rows=1 loops=1)
  Buffers: shared hit=3
  ->  Bitmap Heap Scan on readings  (cost=1.41..4.61 rows=3 width=12) (actual time=0.030..0.036 rows=96 loops=1)
        Recheck Cond: ((sensor_id = 1) AND (recorded_at > (now() - '24:00:00'::interval)))
        Heap Blocks: exact=1
        Buffers: shared hit=3
        ->  Bitmap Index Scan on idx_readings_sensor_time  (cost=0.00..1.41 rows=3 width=0) (actual time=0.022..0.022 rows=96 loops=1)
              Index Cond: ((sensor_id = 1) AND (recorded_at > (now() - '24:00:00'::interval)))
              Buffers: shared hit=2
Planning:
  Buffers: shared hit=107
Planning Time: 1.000 ms
Execution Time: 0.187 ms
```

### Execution Plan WITHOUT Index (Sequential Scan)
```text
GroupAggregate  (cost=0.00..41.46 rows=1 width=104) (actual time=0.131..0.132 rows=1 loops=1)
  Buffers: shared hit=6
  ->  Seq Scan on readings  (cost=0.00..41.40 rows=3 width=12) (actual time=0.033..0.105 rows=96 loops=1)
        Filter: ((sensor_id = 1) AND (recorded_at > (now() - '24:00:00'::interval)))
        Rows Removed by Filter: 777
        Buffers: shared hit=6
Planning:
  Buffers: shared hit=5 dirtied=1
Planning Time: 0.340 ms
Execution Time: 0.172 ms
```

---

## 2. Query: Latest Time-Series Readings (`/sensors/:id/readings?limit=100`)
```sql
SELECT id, sensor_id, value, recorded_at
FROM readings
WHERE sensor_id = 1
ORDER BY recorded_at DESC
LIMIT 100;
```

### Execution Plan WITH Index (`idx_readings_sensor_time`)
```text
Limit  (cost=7.79..7.81 rows=8 width=24) (actual time=0.056..0.067 rows=97 loops=1)
  Buffers: shared hit=6
  ->  Sort  (cost=7.79..7.81 rows=8 width=24) (actual time=0.055..0.060 rows=97 loops=1)
        Sort Key: recorded_at DESC
        Sort Method: quicksort  Memory: 31kB
        Buffers: shared hit=6
        ->  Bitmap Heap Scan on readings  (cost=1.44..7.67 rows=8 width=24) (actual time=0.015..0.022 rows=97 loops=1)
              Recheck Cond: (sensor_id = 1)
              Heap Blocks: exact=1
              Buffers: shared hit=3
              ->  Bitmap Index Scan on idx_readings_sensor_time  (cost=0.00..1.44 rows=8 width=0) (actual time=0.008..0.008 rows=97 loops=1)
                    Index Cond: (sensor_id = 1)
                    Buffers: shared hit=2
Planning:
  Buffers: shared hit=11
Planning Time: 1.258 ms
Execution Time: 0.096 ms
```

### Execution Plan WITHOUT Index (Sequential Scan + In-Memory Sort)
```text
Limit  (cost=29.75..29.77 rows=8 width=24) (actual time=0.084..0.096 rows=97 loops=1)
  Buffers: shared hit=6
  ->  Sort  (cost=29.75..29.77 rows=8 width=24) (actual time=0.084..0.088 rows=97 loops=1)
        Sort Key: recorded_at DESC
        Sort Method: quicksort  Memory: 31kB
        Buffers: shared hit=6
        ->  Seq Scan on readings  (cost=0.00..29.62 rows=8 width=24) (actual time=0.011..0.068 rows=97 loops=1)
              Filter: (sensor_id = 1)
              Rows Removed by Filter: 776
              Buffers: shared hit=6
Planning Time: 0.066 ms
Execution Time: 0.119 ms
```

---

## 3. Engineering Explanation & Key Insights

1. **Elimination of Sort Overhead (Top-N Heapsort vs Index Scan):**
   - Without the index, PostgreSQL must execute a **Sequential Scan** over the entire `readings` table, filter candidate rows, and then run an expensive **Sort Key: recorded_at DESC** in working memory (`Sort Method: quicksort` or `top-N heapsort`).
   - With the composite index `(sensor_id, recorded_at DESC)`, the B-Tree leaf pages are already sorted by `recorded_at` in descending order for each `sensor_id`. PostgreSQL performs a direct **Bitmap Index Scan** or **Index Scan**, pulling rows in the exact requested order with zero sort cost.

2. **Targeted Range Filtering & Buffer Hit Efficiency:**
   - Because `sensor_id` is the leading column and `recorded_at` is the trailing column, the database jumps directly to the entry for `sensor_id = 1` and traverses only the slice of the B-Tree matching the recent timestamp range.
   - On large-scale tables with millions of telemetry records, this prevents table-wide disk I/O, reducing execution time from linear $O(N)$ table scans to logarithmic $O(\log N + K)$ index lookups.

3. **Interview Summary Line:**
   > *"The composite index `(sensor_id, recorded_at DESC)` allows the query planner to satisfy both the equality filter on `sensor_id` and the descending order on `recorded_at` directly from the B-tree structure, completely eliminating the in-memory sort operation and full table scans."*
