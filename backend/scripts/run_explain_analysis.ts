import { pool } from '../src/db';
import * as fs from 'fs';
import * as path from 'path';

async function runExplainAnalysis() {
  console.log('🔍 Running EXPLAIN ANALYZE comparison...');

  const querySummary = `
    EXPLAIN (ANALYZE, BUFFERS)
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
  `;

  const queryLatestReadings = `
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT id, sensor_id, value, recorded_at
    FROM readings
    WHERE sensor_id = 1
    ORDER BY recorded_at DESC
    LIMIT 100;
  `;

  // 1. With Index
  const planSummaryWith = await pool.query(querySummary);
  const planReadingsWith = await pool.query(queryLatestReadings);
  const textSummaryWith = planSummaryWith.rows.map((r: any) => r['QUERY PLAN']).join('\n');
  const textReadingsWith = planReadingsWith.rows.map((r: any) => r['QUERY PLAN']).join('\n');

  // 2. Drop Index temporarily
  await pool.query('DROP INDEX IF EXISTS idx_readings_sensor_time;');

  // Without Index
  const planSummaryWithout = await pool.query(querySummary);
  const planReadingsWithout = await pool.query(queryLatestReadings);
  const textSummaryWithout = planSummaryWithout.rows.map((r: any) => r['QUERY PLAN']).join('\n');
  const textReadingsWithout = planReadingsWithout.rows.map((r: any) => r['QUERY PLAN']).join('\n');

  // 3. Recreate Index
  await pool.query('CREATE INDEX IF NOT EXISTS idx_readings_sensor_time ON readings (sensor_id, recorded_at DESC);');

  const report = `# SiteWatch — PostgreSQL Index Optimization Analysis

## Objective & Background
In IoT structural monitoring, thousands of sensor telemetry readings arrive every minute. 
The two most critical query patterns are:
1. **Time-series graphing**: Retrieving the latest $N$ readings for a specific sensor sorted newest-first (\`ORDER BY recorded_at DESC LIMIT 100\`).
2. **Health summary aggregation**: Calculating 24-hour \`MIN\`, \`MAX\`, and \`AVG\` values for a specific sensor.

To optimize these patterns, we created a composite B-Tree index:
\`\`\`sql
CREATE INDEX idx_readings_sensor_time ON readings (sensor_id, recorded_at DESC);
\`\`\`

---

## 1. Query: 24-Hour Metric Aggregation (\`/sensors/:id/summary\`)
\`\`\`sql
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
\`\`\`

### Execution Plan WITH Index (\`idx_readings_sensor_time\`)
\`\`\`text
${textSummaryWith}
\`\`\`

### Execution Plan WITHOUT Index (Sequential Scan)
\`\`\`text
${textSummaryWithout}
\`\`\`

---

## 2. Query: Latest Time-Series Readings (\`/sensors/:id/readings?limit=100\`)
\`\`\`sql
SELECT id, sensor_id, value, recorded_at
FROM readings
WHERE sensor_id = 1
ORDER BY recorded_at DESC
LIMIT 100;
\`\`\`

### Execution Plan WITH Index (\`idx_readings_sensor_time\`)
\`\`\`text
${textReadingsWith}
\`\`\`

### Execution Plan WITHOUT Index (Sequential Scan + In-Memory Sort)
\`\`\`text
${textReadingsWithout}
\`\`\`

---

## 3. Engineering Explanation & Key Insights

1. **Elimination of Sort Overhead (Top-N Heapsort vs Index Scan):**
   - Without the index, PostgreSQL must execute a **Sequential Scan** over the entire \`readings\` table, filter candidate rows, and then run an expensive **Sort Key: recorded_at DESC** in working memory (\`Sort Method: quicksort\` or \`top-N heapsort\`).
   - With the composite index \`(sensor_id, recorded_at DESC)\`, the B-Tree leaf pages are already sorted by \`recorded_at\` in descending order for each \`sensor_id\`. PostgreSQL performs a direct **Bitmap Index Scan** or **Index Scan**, pulling rows in the exact requested order with zero sort cost.

2. **Targeted Range Filtering & Buffer Hit Efficiency:**
   - Because \`sensor_id\` is the leading column and \`recorded_at\` is the trailing column, the database jumps directly to the entry for \`sensor_id = 1\` and traverses only the slice of the B-Tree matching the recent timestamp range.
   - On large-scale tables with millions of telemetry records, this prevents table-wide disk I/O, reducing execution time from linear $O(N)$ table scans to logarithmic $O(\\log N + K)$ index lookups.

3. **Interview Summary Line:**
   > *"The composite index \`(sensor_id, recorded_at DESC)\` allows the query planner to satisfy both the equality filter on \`sensor_id\` and the descending order on \`recorded_at\` directly from the B-tree structure, completely eliminating the in-memory sort operation and full table scans."*
`;

  const docsDir = path.join(__dirname, '../docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  const filePath = path.join(docsDir, 'INDEX_EXPLAIN_ANALYSIS.md');
  fs.writeFileSync(filePath, report, 'utf-8');
  console.log(`✅ Saved EXPLAIN ANALYZE comparison report to ${filePath}`);
  process.exit(0);
}

runExplainAnalysis().catch((err) => {
  console.error('❌ Failed to run explain analysis:', err);
  process.exit(1);
});
