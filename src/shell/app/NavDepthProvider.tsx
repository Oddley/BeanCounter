import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const NavDepthCtx = createContext(0)

export function useNavDepth(): number {
  return useContext(NavDepthCtx)
}

// Tracks how many net forward navigations have occurred in this session.
// PUSH increments, POP decrements (floor 0), REPLACE is neutral.
// Resets to 0 on every fresh app launch, so it is immune to Chrome's
// habit of restoring history.state (and thus location.key / history.length)
// without restoring the full history stack.
export function NavDepthProvider({
  children,
}: {
  readonly children: React.ReactNode
}) {
  const navType = useNavigationType()
  const { key } = useLocation()
  const [depth, setDepth] = useState(0)
  const prevKeyRef = useRef(key)

  useEffect(() => {
    if (key === prevKeyRef.current) return
    prevKeyRef.current = key
    if (navType === 'PUSH') setDepth((d) => d + 1)
    else if (navType === 'POP') setDepth((d) => Math.max(0, d - 1))
  }, [key, navType])

  return <NavDepthCtx.Provider value={depth}>{children}</NavDepthCtx.Provider>
}
