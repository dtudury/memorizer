import { h } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/display/h.js'
import { handle, showIfElse } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/display/helpers.js'
import { render } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/display/render.js'
import { TurtleDB } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleDB.js'
import { Signer } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/Signer.js'
import { Recaller } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/Recaller.js'
import { proxyWithRecaller } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/proxyWithRecaller.js'
import { webSocketMuxFactory } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/webSocketMuxFactory.js'

/**
 * @typedef {import('../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/Workspace.js').Workspace} Workspace
 */

const name = 'memorizer'
const publicKey = window.location.pathname.match(/\/([0-9a-z]*)\//)?.[1] || 'juu2u25yqod1ticwiwnpujtaishju3msefvy79oiti00d8xir0' 
const recaller = new Recaller(name)
let renderer = render(document.body, h`
  <p>connecting...</p>
`, recaller, 'connecting')

const turtleDB = new TurtleDB(name, recaller)
console.log('setting turtleDB')
window.turtleDB = turtleDB
console.log('set turtleDB', window.turtleDB)
window.Signer = Signer

webSocketMuxFactory(turtleDB, async tbMux => {
  console.log(publicKey)
  const memorizerTB = await turtleDB.summonBoundTurtleBranch(publicKey)
  const states = JSON.parse(memorizerTB.lookup('document', 'value', 'fs', 'states.json'))
  recaller.unwatch(renderer)
  const state = proxyWithRecaller({}, recaller)
  /*
  const copyPublicKey = (el, e) => {
    navigator.clipboard.writeText(state.publicKey)
  }
  const send = async (e, el) => {
    e.preventDefault()
    const formData = new FormData(el)
    el.reset()
    const message = formData.get('message')
    const messagesState = workspace.committedBranch.lookup('document', 'value') || {}
    messagesState.history ??= []
    messagesState.history.push({ message, ts: new Date() })
    await workspace.commit(messagesState, 'send')
  }
    */

  const signIn = async (e, el) => {
    e.preventDefault()
    const formData = new FormData(el)
    el.reset()
    const username = formData.get('username')
    const password = formData.get('password')
    const turtlename = formData.get('turtlename') || name
    const signer = new Signer(username, password)
    const {publicKey} = await signer.makeKeysFor(turtlename)
    state.workspace = await turtleDB.makeWorkspace(signer, turtlename)
    state.publicKey = publicKey
  }

  const getHistory = () => state.workspace.lookup('document', 'value', 'history') || 
    Object.keys(states).map(abbr => [
      Object.assign({abbr, history: [], key: 'abbr', id: `${abbr}.abbr`}, states[abbr]),
      Object.assign({abbr, history: [], key: 'capital', id: `${abbr}.capital`}, states[abbr])
    ]).flat()

  const sortedStates = el => {
    const history = getHistory()
    return h`
      <ol>
        ${history.map(({name, key, id}) => {
          const reveal = (e, el) => { state.revealed = id }
          return h`
            <li>
              <button onclick=${handle(reveal)}>${name} ${key}</button>
            </li>
          `
        })}
      </ol>
    `
  }

  const selectedState = el => {
    if (state.revealed) {
      const selected = getHistory().find(q => q.id === state.revealed)
      const unselect = (e, el) => { state.revealed = null}
      return h`<section id="answer" onclick=${handle(unselect)}>${selected.name} ${selected.key}: ${selected[selected.key]}</section>`
    } else {
      const selected = getHistory()[0]
      const reveal = (e, el) => state.revealed = selected.id
      return h`<section id="question" onclick=${handle(reveal)}> ${selected.name} ${selected.key}: ???</section>`
    }
  }

  renderer = render(document.body, h`
    ${showIfElse(() => !!state.workspace, h`
      ${selectedState}
      <details id="questions">
        <summary>Questions</summary>
        ${sortedStates}
      </details>
    `, h`
      <section id="signin">
        <h2>Sign In or Create Your Account</h2>
        <form onsubmit=${handle(signIn)}>
          <div>
            <input type="text" id="username" name="username" placeholder="" autocomplete="off" required autofocus />
            <label for="username">username</label>
          </div>

          <div>
            <input type="password" id="pass" name="password" placeholder="" autocomplete="off" required />
            <label for="pass">password</label>
          </div>

          <div>
            <input type="text" id="turtlename" name="turtlename" placeholder="${name}" autocomplete="off" />
            <label for="turtlename">turtlename</label>
          </div>

          <input type="submit" value="Summon Turtle" />
        </form>
      </section>
    `)}
  `, recaller, 'home-body')
})
