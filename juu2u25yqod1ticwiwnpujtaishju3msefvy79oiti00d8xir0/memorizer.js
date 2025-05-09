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
const publicKey = window.location.pathname.match(/\/([0-9a-z]*)\//)?.[1]
const recaller = new Recaller(name)
let renderer = render(document.body, h`
  <p>connecting...</p>
`, recaller, 'connecting')

const turtleDB = new TurtleDB(name, recaller)
window.turtleDB = turtleDB
window.Signer = Signer
/** @type {Workspace} */
let workspace

const members = {
}

webSocketMuxFactory(turtleDB, async tbMux => {
  recaller.unwatch(renderer)
  const state = proxyWithRecaller({
    loggedIn: false
  }, recaller)
  const copyPublicKey = (el, e) => {
    navigator.clipboard.writeText(state.publicKey)
  }
  const send = async (e, el) => {
    e.preventDefault()
    const formData = new FormData(el)
    el.reset()
    const message = formData.get('message')
    const messagesState = workspace.committedBranch.lookup('document', 'value') || {}
    messagesState.messages ??= []
    messagesState.messages.push({ message, ts: new Date() })
    await workspace.commit(messagesState, 'send')
  }
  const signIn = async (e, el) => {
    e.preventDefault()
    const formData = new FormData(el)
    el.reset()
    const username = formData.get('username')
    const password = formData.get('password')
    const turtlename = formData.get('turtlename') || name
    const signer = new Signer(username, password)
    workspace = await turtleDB.makeWorkspace(signer, turtlename)
    const {publicKey} = await signer.makeKeysFor(turtlename)
    state.publicKey = publicKey
    state.loggedIn = true
    state.memberTurtles = await Promise.all(Object.keys(members).map(async publicKey => {
      const turtleBranch = await turtleDB.summonBoundTurtleBranch(publicKey, members[publicKey])
      return { turtleBranch, publicKey, name: members[publicKey] }
    }))
  }
  const sortedMessages = el => {
    if (!state.memberTurtles) return null
    let allMessages = []
    for (const memberTurtle of state.memberTurtles) {
      allMessages = allMessages.concat((memberTurtle.turtleBranch.lookup('document', 'value', 'messages') ?? []).map(message => {
        if (typeof message === 'object') message.name = memberTurtle.name
        return message
      }))
    }
    allMessages.sort((a, b) => a.ts - b.ts)
    return allMessages.map(({message, ts, name}) => h`
      <div>
        [${ts?.toLocaleTimeString?.()}]
        ${name}: ${message} 
      </div>
    `)
  }
  renderer = render(document.body, h`
    <p>connected</p>
    <div>
    ${sortedMessages}
    </div>
    ${showIfElse(() => state.loggedIn, h`
      <button onclick=${handle(copyPublicKey)}>${() => state.publicKey} ✂</button>
      <form onsubmit=${handle(send)}>
        <div>
          <input type="text" id="message" name="message" placeholder="type here" autocomplete="off" required />
          <label for="message">message</label>
        </div>

        <input type="submit" value="Send" />
      </form>
    `, h`
      <form onsubmit=${handle(signIn)}>
        <div>
          <input type="text" id="username" name="username" placeholder="" autocomplete="off" required />
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
    `)}
  `, recaller, 'home-body')
})
