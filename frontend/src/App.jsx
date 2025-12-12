import { useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts'

const API_BASE = '/api'
const ALGO_COLORS = {
  bruteforce: '#e11d48', // red
  nearest_neighbor: '#2563eb', // blue
  mst_prim: '#16a34a', // green
  random_search: '#f59e0b', // orange
}


function CityMap({ cities, homeCity, routeBetween, distanceMatrix, positions }) {
  const width = 260
  const height = 260

  const edges = useMemo(() => {
    const result = []
    if (!cities?.length || !distanceMatrix?.length) return result

    for (let i = 0; i < cities.length; i++) {
      for (let j = i + 1; j < cities.length; j++) {
        const c1 = cities[i]
        const c2 = cities[j]
        const p1 = positions?.[c1]
        const p2 = positions?.[c2]
        if (!p1 || !p2) continue
        const d = distanceMatrix[i]?.[j]
        if (d == null) continue
        result.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, label: d })
      }
    }
    return result
  }, [cities, distanceMatrix, positions])

  const routePoints = useMemo(() => {
    if (!homeCity || !positions || !Object.keys(positions).length) return ''
    const fullRoute = [homeCity, ...(routeBetween || []), homeCity]
    if (fullRoute.length < 2) return ''

    return fullRoute
      .map((city) => {
        const p = positions[city]
        return p ? `${p.x},${p.y}` : ''
      })
      .filter(Boolean)
      .join(' ')
  }, [homeCity, routeBetween, positions])

  if (!cities.length || !positions || !Object.keys(positions).length) {
    return (
      <div className="panel-body map-body">
        <p className="map-caption">Map will appear after a round is generated.</p>
      </div>
    )
  }

  return (
    <div className="panel-body map-body">
      <svg viewBox={`0 0 ${width} ${height}`} className="city-map" preserveAspectRatio="xMidYMid meet">
        {edges.map((e, idx) => (
          <g key={idx} className="edge">
            <line className="edge-line" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
            <text className="edge-label" x={(e.x1 + e.x2) / 2} y={(e.y1 + e.y2) / 2 - 3}>
              {e.label}
            </text>
          </g>
        ))}

        {routePoints && <polyline className="route-line-svg" points={routePoints} />}

        {cities.map((city) => {
          const pos = positions[city]
          if (!pos) return null
          const isHome = city === homeCity
          return (
            <g key={city} className="city-node">
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isHome ? 11 : 8}
                className={'city-dot ' + (isHome ? 'home-dot' : '')}
              />
              <text x={pos.x} y={pos.y + 3} className="city-label-svg">
                {city}
              </text>
            </g>
          )
        })}
      </svg>

      <p className="map-caption">
        Random map for this round. Line labels are distances (from the distance matrix). The glowing
        path is your current route.
      </p>
    </div>
  )
}

function PerformanceChart() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const [useLogScale, setUseLogScale] = useState(true)

  const load = async () => {
    setErr(null)
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/performance?limit=15`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load performance')

      const rounds = (json.rounds || []).map((r) => ({
        ...r,
        roundLabel: `#${r.sessionId}`,
        playerName: r.playerName ?? null,
        bruteforce: toSafeMs(r.bruteforce),
        nearest_neighbor: toSafeMs(r.nearest_neighbor),
        mst_prim: toSafeMs(r.mst_prim),
        random_search: toSafeMs(r.random_search),
      }))

      setData(rounds)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const fmt = (v) => (v === null || v === undefined ? '—' : Number(v).toFixed(3))

  const yDomain = useMemo(() => {
    const vals = []
    for (const r of data) {
      for (const k of ['bruteforce', 'nearest_neighbor', 'mst_prim', 'random_search']) {
        const v = r?.[k]
        if (v != null && Number.isFinite(v) && v > 0) vals.push(v)
      }
    }
    if (!vals.length) return [0.001, 1]
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    return [min * 0.8, max * 1.2]
  }, [data])

  return (
    <div className="panel-body">
      {err && (
        <div className="toast toast-error">
          <strong>Error:</strong> {err}
        </div>
      )}

      <div className="button-row" style={{ marginBottom: 10, alignItems: 'center' }}>
        <button className="btn btn-ghost" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>

        <span className="badge badge-soft">{data.length || 0} rounds</span>

        <div style={{ flex: 1 }} />

        <button
          className={'btn ' + (useLogScale ? 'btn-primary' : 'btn-ghost')}
          onClick={() => setUseLogScale((v) => !v)}
          disabled={!data.length}
          title="Recommended when some algorithms take much longer than others."
        >
          {useLogScale ? 'Log scale: ON' : 'Log scale: OFF'}
        </button>
      </div>

      {!data.length && !err && (
        <p className="hint-text">
          No submitted rounds found yet. Play a round and press “Check Answer” — then analytics will appear.
        </p>
      )}

      {!!data.length && (
        <>
          <div style={{ width: '100%', height: 340 }}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="roundLabel" />

                <YAxis
                  scale={useLogScale ? 'log' : 'auto'}
                  domain={useLogScale ? yDomain : ['auto', 'auto']}
                  allowDataOverflow
                  tickFormatter={(v) => `${Number(v).toFixed(useLogScale ? 3 : 0)}`}
                  label={{ value: 'Time (ms)', angle: -90, position: 'insideLeft' }}
                />

                <Tooltip
                  formatter={(value) =>
                    value === null || value === undefined ? '—' : `${Number(value).toFixed(3)} ms`
                  }
                  labelFormatter={(label, payload) => {
                    const r = payload?.[0]?.payload
                    const p = r?.playerName ? ` • Player: ${r.playerName}` : ' • Player: —'
                    const h = r?.homeCity ? ` • Home: ${r.homeCity}` : ''
                    return `${label}${p}${h}`
                  }}
                />

                <Legend />

                <Line
                  type="monotone"
                  dataKey="bruteforce"
                  name="Brute Force"
                  dot={false}
                  stroke={ALGO_COLORS.bruteforce}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="nearest_neighbor"
                  name="Nearest Neighbor"
                  dot={false}
                  stroke={ALGO_COLORS.nearest_neighbor}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="mst_prim"
                  name="MST (Prim)"
                  dot={false}
                  stroke={ALGO_COLORS.mst_prim}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="random_search"
                  name="Random Search"
                  dot={false}
                  stroke={ALGO_COLORS.random_search}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p className="small-note" style={{ marginTop: 10 }}>
            {useLogScale ? (
              <>
                Using a <strong>logarithmic</strong> Y-axis so very small and very large timings are visible together.
              </>
            ) : (
              <>
                Using a <strong>linear</strong> Y-axis (small timings may look flat if brute force is very large).
              </>
            )}
          </p>

          <h3 className="section-heading" style={{ marginTop: 14 }}>
            Raw Data Used for the Chart (Last 15 Rounds)
          </h3>

          <div className="panel-body scrollable">
            <table className="matrix algo-table">
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Session</th>
                  <th>Player (only if correct)</th>
                  <th>Home</th>
                  <th>Brute (ms)</th>
                  <th>NN (ms)</th>
                  <th>MST (ms)</th>
                  <th>Random (ms)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r, idx) => (
                  <tr key={r.sessionId}>
                    <td>{idx + 1}</td>
                    <td>#{r.sessionId}</td>
                    <td>{r.playerName ?? '—'}</td>
                    <td>{r.homeCity || '—'}</td>
                    <td>{fmt(r.bruteforce)}</td>
                    <td>{fmt(r.nearest_neighbor)}</td>
                    <td>{fmt(r.mst_prim)}</td>
                    <td>{fmt(r.random_search)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="small-note" style={{ marginTop: 10 }}>
            This table is exactly what the chart uses.
          </p>
        </>
      )}
    </div>
  )
}

function toSafeMs(v) {
  if (v === null || v === undefined) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (n <= 0) return null
  return Math.max(n, 0.001)
}

function ComplexityInfo() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/complexity`)
      const json = await res.json()
      setData(json)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  if (!data) {
    return (
      <div className="panel-body">
        <button className="btn btn-ghost" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Reveal complexity'}
        </button>
      </div>
    )
  }

  return (
    <div className="panel-body">
      <ul className="complexity-list">
        <li>
          <span className="complexity-title">Brute Force (Exact)</span>
          <span className="complexity-body">{data.bruteforce}</span>
        </li>
        <li>
          <span className="complexity-title">MST using Prim’s Algorithm</span>
          <span className="complexity-body">{data.mst_prim}</span>
        </li>
        <li>
          <span className="complexity-title">Nearest Neighbor (Greedy)</span>
          <span className="complexity-body">{data.nearest_neighbor}</span>
        </li>
        <li>
          <span className="complexity-title">Random Search (Monte Carlo)</span>
          <span className="complexity-body">{data.random_search}</span>
        </li>
      </ul>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('game')

  const [playerName, setPlayerName] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [cities, setCities] = useState([])
  const [homeCity, setHomeCity] = useState(null)
  const [distanceMatrix, setDistanceMatrix] = useState([])
  const [selectedCities, setSelectedCities] = useState([])
  const [routeBetween, setRouteBetween] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [cityPositions, setCityPositions] = useState({})

  const generateRandomPositions = (cityList) => {
    const width = 260
    const height = 260
    const margin = 30
    const positions = {}
    cityList.forEach((city) => {
      positions[city] = {
        x: margin + Math.random() * (width - margin * 2),
        y: margin + Math.random() * (height - margin * 2),
      }
    })
    return positions
  }

  const startNewGame = async () => {
    setError(null)
    setResult(null)
    setSessionId(null)

    if (!playerName.trim()) {
      setError('Please enter your player name first.')
      return
    }

    try {
      const res = await fetch(`${API_BASE}/new-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start game')

      setCities(data.cities)
      setHomeCity(data.homeCity)
      setDistanceMatrix(data.distanceMatrix)

      setSelectedCities([])
      setRouteBetween([])
      setCityPositions(generateRandomPositions(data.cities))

      setActiveTab('game')
    } catch (e) {
      setError(e.message)
    }
  }

  const toggleSelectedCity = (city) => {
    if (city === homeCity) return
    setResult(null)

    setSelectedCities((prev) => {
      const exists = prev.includes(city)
      const next = exists ? prev.filter((c) => c !== city) : [...prev, city]
      setRouteBetween((rb) => rb.filter((c) => next.includes(c)))
      return next
    })
  }

  const addToRoute = (city) => {
    if (!selectedCities.includes(city)) return
    setResult(null)
    setRouteBetween((prev) => (prev.includes(city) ? prev : [...prev, city]))
  }

  const clearRoute = () => setRouteBetween([])

  const submitAnswer = async () => {
    setError(null)
    setResult(null)

    if (!homeCity || !distanceMatrix?.length) return setError('Start a new round first.')
    if (!playerName.trim()) return setError('Please enter your player name.')
    if (routeBetween.length === 0) return setError('Build a route by clicking on selected cities.')

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/check-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName,
          routeBetween,
          homeCity,
          distanceMatrix,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to check answer')

      setResult(data)
      setSessionId(data.sessionId ?? null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const renderMatrix = () => {
    if (!distanceMatrix.length) return null
    return (
      <div className="panel-body scrollable">
        <table className="matrix">
          <thead>
            <tr>
              <th></th>
              {cities.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {distanceMatrix.map((row, i) => (
              <tr key={i}>
                <th>{cities[i]}</th>
                {row.map((d, j) => (
                  <td key={j}>{i === j ? '—' : d}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const step = !homeCity ? 1 : homeCity && !selectedCities.length ? 2 : !result ? 3 : 4

  return (
    <div className="app-root">
      <div className="background-glow" />

      <header className="top-header">
        <div>
          <h1 className="game-title">Traveling Salesman Arena</h1>
          <p className="subtitle">Game mode + Analytics mode (separated for clarity).</p>
        </div>

        <div className="badge-row">
          <span className="badge badge-outline">
            {sessionId ? `Session #${sessionId}` : 'No submitted session yet'}
          </span>
          {homeCity && (
            <span className="badge badge-home">
              Home City: <strong>{homeCity}</strong>
            </span>
          )}
        </div>
      </header>

      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className={'btn ' + (activeTab === 'game' ? 'btn-primary' : 'btn-ghost')}
            onClick={() => setActiveTab('game')}
          >
            🎮 Game
          </button>
          <button
            className={'btn ' + (activeTab === 'analytics' ? 'btn-primary' : 'btn-ghost')}
            onClick={() => setActiveTab('analytics')}
          >
            📊 Analytics
          </button>

          <div style={{ flex: 1 }} />
          <span className="badge badge-soft">Step {step}</span>
        </div>
      </div>

      {error && (
        <div className="toast toast-error" style={{ marginBottom: 14 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {activeTab === 'game' && (
        <main className="game-layout">
          <section className="column column-left">
            <div className="panel panel-hero">
              <div className="panel-header">
                <h2>Game Controls</h2>
                <span className="badge badge-soft">Round setup</span>
              </div>
              <div className="panel-body">
                <label className="field">
                  <span>Player name</span>
                  <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Commander ID"
                  />
                </label>

                <button className="btn btn-primary btn-wide" onClick={startNewGame}>
                  {homeCity ? 'Start New Round' : 'Launch First Round'}
                </button>

                <p className="hint-text" style={{ marginTop: 10 }}>
                  Each round generates a symmetric distance matrix (50–100 km) and a random home city (A–J).
                </p>
              </div>
            </div>

            {!!distanceMatrix.length && (
              <div className="panel">
                <div className="panel-header">
                  <h2>Select Cities</h2>
                  <span className="badge badge-soft">Step 2</span>
                </div>
                <div className="panel-body">
                  <p className="hint-text">
                    Choose cities to visit once. Start and end at <strong>{homeCity}</strong>.
                  </p>

                  <div className="city-grid">
                    {cities.map((c) => (
                      <button
                        key={c}
                        className={
                          'city-chip ' +
                          (c === homeCity ? 'home' : '') +
                          (selectedCities.includes(c) ? 'selected' : '')
                        }
                        onClick={() => toggleSelectedCity(c)}
                        disabled={c === homeCity}
                      >
                        <span className="city-letter">{c}</span>
                        {c === homeCity ? (
                          <span className="city-label">Home</span>
                        ) : selectedCities.includes(c) ? (
                          <span className="city-label">Selected</span>
                        ) : (
                          <span className="city-label">Available</span>
                        )}
                      </button>
                    ))}
                  </div>

                  <p className="small-note">Recommended: up to 8 cities for fast brute force.</p>
                </div>
              </div>
            )}

            {!!selectedCities.length && (
              <div className="panel">
                <div className="panel-header">
                  <h2>Build Route</h2>
                  <span className="badge badge-soft">Step 3</span>
                </div>
                <div className="panel-body">
                  <p className="hint-text">
                    Click selected cities in the visiting order. Each city can appear once.
                  </p>

                  <div className="city-grid route-grid">
                    {selectedCities.map((c) => (
                      <button
                        key={c}
                        onClick={() => addToRoute(c)}
                        className={'route-chip ' + (routeBetween.includes(c) ? 'route-chip-used' : '')}
                      >
                        {c}
                      </button>
                    ))}
                  </div>

                  <div className="current-route">
                    <span>Your current path</span>
                    <div className="route-line">
                      {homeCity && (
                        <>
                          <span className="route-node home">{homeCity}</span>
                          {routeBetween.map((c) => (
                            <span key={c} className="route-node">
                              {c}
                            </span>
                          ))}
                          <span className="route-node home">{homeCity}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="button-row">
                    <button className="btn btn-ghost" onClick={clearRoute}>
                      Reset path
                    </button>
                    <button className="btn btn-accent" onClick={submitAnswer} disabled={loading}>
                      {loading ? 'Running algorithms…' : 'Check Answer'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="column column-right">
            <div className="panel">
              <div className="panel-header">
                <h2>City Distance Map</h2>
                <span className="badge badge-soft">Visualization</span>
              </div>
              <CityMap
                cities={cities}
                homeCity={homeCity}
                routeBetween={routeBetween}
                distanceMatrix={distanceMatrix}
                positions={cityPositions}
              />
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2>Distance Grid</h2>
                <span className="badge badge-soft">Same data</span>
              </div>
              {renderMatrix()}
            </div>

            <div className="panel panel-result">
              <div className="panel-header">
                <h2>Round Results</h2>
                <span className="badge badge-soft">{result ? 'Available' : 'Pending'}</span>
              </div>

              {!result ? (
                <div className="panel-body">
                  <p className="hint-text">Submit your route to see results and algorithm comparison.</p>
                </div>
              ) : (
                <div className="panel-body">
                  <span className={'result-pill ' + (result.correct ? 'result-pill-win' : 'result-pill-lose')}>
                    {result.correct ? 'Perfect Route!' : 'Better path exists'}
                  </span>

                  <p className="result-message" style={{ marginTop: 10 }}>
                    {result.message}
                  </p>

                  <div className="info-cards">
                    <div className="info-card">
                      <h3>Your Route</h3>
                      <p className="route-text">{result.yourRoute.join(' → ')}</p>
                      <p className="metric">
                        Distance: <span>{result.yourDistance} km</span>
                      </p>
                    </div>
                    <div className="info-card">
                      <h3>Optimal Route</h3>
                      <p className="route-text">{result.optimalRoute.join(' → ')}</p>
                      <p className="metric">
                        Distance: <span>{result.optimalDistance} km</span>
                      </p>
                    </div>
                  </div>

                  <h3 className="section-heading">Algorithm Showdown</h3>
                  <div className="panel-body scrollable">
                    <table className="matrix algo-table">
                      <thead>
                        <tr>
                          <th>Algorithm</th>
                          <th>Route</th>
                          <th>Distance</th>
                          <th>Time (ms)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(result.algorithms).map(([name, info]) => (
                          <tr key={name}>
                            <td className="algo-name">{formatAlgoName(name)}</td>
                            <td>{info.route.join(' → ')}</td>
                            <td>{info.distance}</td>
                            <td>{info.durationMs.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="small-note" style={{ marginTop: 10 }}>
                    Want charts? Switch to <strong>Analytics</strong> tab.
                  </p>
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {activeTab === 'analytics' && (
        <main className="analytics-layout">
          <section className="analytics-row">
            <div className="panel">
              <div className="panel-header">
                <h2>Performance Chart (Last 15 Rounds)</h2>
                <span className="badge badge-soft">Execution Time</span>
              </div>
              <PerformanceChart />
            </div>
          </section>

          <section className="analytics-row">
            <div className="panel panel-complexity">
              <div className="panel-header">
                <h2>Algorithm Complexity Analysis</h2>
                <span className="badge badge-soft">Big-O Notation</span>
              </div>
              <ComplexityInfo />
            </div>
          </section>
        </main>
      )}
    </div>
  )
}

function formatAlgoName(name) {
  switch (name) {
    case 'bruteforce':
      return 'Brute Force (Exact)'
    case 'mst_prim':
      return 'MST using Prim’s'
    case 'nearest_neighbor':
      return 'Nearest Neighbor'
    case 'random_search':
      return 'Random Search'
    default:
      return name
  }
}
