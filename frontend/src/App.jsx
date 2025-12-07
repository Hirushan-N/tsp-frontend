import { useState, useMemo } from 'react'

const API_BASE = '/api'

function CityMap({ cities, homeCity, routeBetween, distanceMatrix, positions }) {
  const width = 260
  const height = 260

  const edges = useMemo(() => {
    const result = []
    if (!cities || !cities.length || !distanceMatrix || !distanceMatrix.length) return result
    for (let i = 0; i < cities.length; i++) {
      for (let j = i + 1; j < cities.length; j++) {
        const c1 = cities[i]
        const c2 = cities[j]
        const p1 = positions?.[c1]
        const p2 = positions?.[c2]
        if (!p1 || !p2) continue
        const d = distanceMatrix[i]?.[j]
        if (d == null) continue
        result.push({
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          label: d,
        })
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
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="city-map"
        preserveAspectRatio="xMidYMid meet"
      >
        {edges.map((e, idx) => (
          <g key={idx} className="edge">
            <line
              className="edge-line"
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
            />
            <text
              className="edge-label"
              x={(e.x1 + e.x2) / 2}
              y={(e.y1 + e.y2) / 2 - 3}
            >
              {e.label}
            </text>
          </g>
        ))}

        {routePoints && (
          <polyline
            className="route-line-svg"
            points={routePoints}
          />
        )}

        {/* City dots on top */}
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
                className={
                  'city-dot ' + (isHome ? 'home-dot' : '')
                }
              />
              <text
                x={pos.x}
                y={pos.y + 3}
                className="city-label-svg"
              >
                {city}
              </text>
            </g>
          )
        })}
      </svg>

      <p className="map-caption">
        This is a random map for this round. Each line shows the distance between two cities
        (from the generated distance matrix). The glowing path is your current route
        (home → cities → home).
      </p>
    </div>
  )
}

function App() {
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
      const x = margin + Math.random() * (width - margin * 2)
      const y = margin + Math.random() * (height - margin * 2)
      positions[city] = { x, y }
    })
    return positions
  }

  const startNewGame = async () => {
    setError(null)
    setResult(null)

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

      setSessionId(data.sessionId)
      setCities(data.cities)
      setHomeCity(data.homeCity)
      setDistanceMatrix(data.distanceMatrix)
      setSelectedCities([])
      setRouteBetween([])

      const positions = generateRandomPositions(data.cities)
      setCityPositions(positions)
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

    setRouteBetween((prev) => {
      if (prev.includes(city)) return prev
      return [...prev, city]
    })
  }

  const clearRoute = () => {
    setRouteBetween([])
  }

  const submitAnswer = async () => {
    setError(null)
    setResult(null)

    if (!sessionId) {
      setError('Start a new game first.')
      return
    }
    if (!playerName.trim()) {
      setError('Please enter your player name.')
      return
    }
    if (routeBetween.length === 0) {
      setError('Build a route by clicking on selected cities.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/check-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          playerName,
          routeBetween,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to check answer')
      setResult(data)
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

  const step =
    !sessionId ? 1 : sessionId && !selectedCities.length ? 2 : !result ? 3 : 4

  return (
    <div className="app-root">
      <div className="background-glow" />
      <header className="top-header">
        <div>
          <h1 className="game-title">Traveling Salesman Arena</h1>
          <p className="subtitle">
            Pick cities, plan your route, and beat the algorithms.
          </p>
        </div>
        <div className="badge-row">
          <span className="badge badge-outline">
            {sessionId ? `Session #${sessionId}` : 'No active round'}
          </span>
          {homeCity && (
            <span className="badge badge-home">
              Home City: <strong>{homeCity}</strong>
            </span>
          )}
        </div>
      </header>

      <main className="game-layout">
        <section className="column column-left">
          <div className="panel panel-hero">
            <div className="panel-header">
              <span className="step-pill">Step {step}</span>
              <h2>Player & Game Control</h2>
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
                {sessionId ? 'Start New Round' : 'Launch First Round'}
              </button>

              <p className="hint-text">
                A new round generates a fresh random distance matrix (50–100 km between each pair of
                cities) and a random home city between <strong>A</strong> and <strong>J</strong>.
                The matrix powers all the algorithms. On the right you see the same data as a random
                map and as a distance grid.
              </p>
            </div>
          </div>

          {distanceMatrix.length > 0 && (
            <div className="panel">
              <div className="panel-header">
                <span className="step-pill muted">Step 2</span>
                <h2>Choose Cities to Visit</h2>
              </div>
              <div className="panel-body">
                <p className="hint-text">
                  Pick your target cities. You must start and end at{' '}
                  <strong>{homeCity}</strong>.
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
                        <span className="city-label">In route</span>
                      ) : (
                        <span className="city-label">Available</span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="small-note">
                  You can choose up to 8 cities to keep the game fast.
                </p>
              </div>
            </div>
          )}

          {selectedCities.length > 0 && (
            <div className="panel">
              <div className="panel-header">
                <span className="step-pill muted">Step 3</span>
                <h2>Build Your Route</h2>
              </div>
              <div className="panel-body">
                <p className="hint-text">
                  Tap the selected cities in the order you want to visit them. Each city can only
                  appear once.
                </p>
                <div className="city-grid route-grid">
                  {selectedCities.map((c) => (
                    <button
                      key={c}
                      onClick={() => addToRoute(c)}
                      className={
                        'route-chip ' + (routeBetween.includes(c) ? 'route-chip-used' : '')
                      }
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
                  <button
                    className="btn btn-accent"
                    onClick={submitAnswer}
                    disabled={loading}
                  >
                    {loading ? 'Running algorithms…' : 'Lock in & check'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="column column-right">
          {distanceMatrix.length > 0 && (
            <>
              <div className="panel panel-map">
                <div className="panel-header">
                  <h2>City Distance Map</h2>
                  <span className="badge badge-soft">
                    Random layout • Line labels are distances
                  </span>
                </div>
                <CityMap
                  cities={cities}
                  homeCity={homeCity}
                  routeBetween={routeBetween}
                  distanceMatrix={distanceMatrix}
                  positions={cityPositions}
                />
              </div>

              <div className="panel panel-matrix">
                <div className="panel-header">
                  <h2>Distance Grid</h2>
                  <span className="badge badge-soft">
                    Same data as map • 50–100 km
                  </span>
                </div>
                {renderMatrix()}
              </div>
            </>
          )}

          {error && (
            <div className="toast toast-error">
              <strong>Error:</strong> {error}
            </div>
          )}

          {result && (
            <div className="panel panel-result">
              <div className="panel-header">
                <h2>Round Results</h2>
                <span
                  className={
                    'result-pill ' + (result.correct ? 'result-pill-win' : 'result-pill-lose')
                  }
                >
                  {result.correct ? 'Perfect Route!' : 'Better path exists'}
                </span>
              </div>
              <div className="panel-body">
                <p className="result-message">{result.message}</p>

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
              </div>
            </div>
          )}

          <div className="panel panel-complexity">
            <div className="panel-header">
              <h2>Algorithm Complexity</h2>
              <span className="badge badge-soft">Big-O intel</span>
            </div>
            <div className="panel-body">
              <ComplexityInfo />
            </div>
          </div>
        </section>
      </main>
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

function ComplexityInfo() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/complexity')
      const json = await res.json()
      console.log(json);
      setData(json)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  if (!data) {
    return (
      <button className="btn btn-ghost" onClick={load} disabled={loading}>
        {loading ? 'Loading…' : 'Reveal complexity'}
      </button>
    )
  }

  return (
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
  )

}

export default App
