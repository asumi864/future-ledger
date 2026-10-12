import { render } from 'preact'
import '@fontsource/inter-tight/500.css'
import '@fontsource/inter-tight/600.css'
import '@fontsource/inter-tight/700.css'
import '@fontsource/zen-kaku-gothic-new/400.css'
import '@fontsource/zen-kaku-gothic-new/500.css'
import '@fontsource/zen-kaku-gothic-new/700.css'
import '@fontsource/ibm-plex-mono/500.css'
import './styles/app.css'
import { registerSW } from 'virtual:pwa-register'
import { useRoute } from './components/ui'
import { initStore, isReady, useDB } from './lib/store'
import { Close } from './screens/Close'
import { Data } from './screens/Data'
import { Home } from './screens/Home'
import { MinutesScreen } from './screens/Minutes'
import { Recovery } from './screens/Recovery'
import { Review } from './screens/Review'
import { Settings } from './screens/Settings'
import { Sheets } from './screens/Sheets'
import { Wishes } from './screens/Wishes'

function App() {
  useDB()
  const route = useRoute()
  if (!isReady()) return null
  const path = route.split('?')[0]
  const Screen = { '/': Home, '/close': Close, '/wishes': Wishes, '/recovery': Recovery, '/review': Review, '/minutes': MinutesScreen, '/settings': Settings, '/data': Data }[path] ?? Home
  return (
    <div class="app">
      <Screen />
      <Sheets />
    </div>
  )
}

// 新しい版を見つけたら自動で切り替える。アプリを開き直したとき・画面に戻ったときにも確認する
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update() })
  },
})
void updateSW

initStore().then(() => render(<App />, document.getElementById('app')!))
