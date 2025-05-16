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
  <section class="info">connecting...</section>
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

  const signIntoStatus = async (username, password) => {
    const signer = new Signer(username, password)
    const {publicKey} = await signer.makeKeysFor(name)
    state.workspace = await turtleDB.makeWorkspace(signer, name)
    state.publicKey = publicKey
    state.tags = proxyWithRecaller({}, recaller)
    state.ts = new Date()
  }

  const signerData = localStorage.getItem('signer')
  if (signerData) {
    const {username, password} = JSON.parse(signerData)
    await signIntoStatus(username, password)
  }

  const signIn = async (e, el) => {
    e.preventDefault()
    const formData = new FormData(el)
    el.reset()
    const username = formData.get('username')
    const password = formData.get('password')
    const rememberme = formData.get('rememberme')
    if (rememberme) localStorage.setItem('signer', JSON.stringify({username, password}))
    signIntoStatus(username, password)
  }

  const getQuestions = () => state.workspace?.lookup?.('document', 'value', 'questions') || 
    [
      ...Object.keys(states).map(abbr => {
        const {name, capital} = states[abbr]
        return [{
          text: `${name}'s Capital:`, 
          answer: capital, 
          history: [], 
          id: `${abbr}.capital`, 
          tags: ['Capitals']
        },{
          text: `${name}'s Abbreviation:`, 
          answer: abbr, 
          history: [], 
          id: `${abbr}.abbr`, 
          tags: ['Abbreviations']
        }]
      }), 
      ...Array(11).keys().map(i => [
        ...Array(i + 1).keys().map(j => {
          const x = i + 2
          const y = j + 2
          return {
            text: `${x} × ${y} =`, 
            answer: x * y, 
            history: [], 
            id: `${x}x${y}`, 
            tags: ['Multiplication']
          }
        })
      ])
    ].flat(2)

  const setQuestions = (questions, message = 'setQuestions') => {
    const value = state.workspace.committedBranch.lookup('document', 'value') || {}
    value.questions = questions
    state.workspace.commit(value, message).then(() => {
      state.ts = new Date()
      state.answerShown = null
    })
  }

  const getTags = () => state.workspace?.lookup?.('document', 'value', 'tags') ||
    new Set(['Abbreviations', 'Multiplication'])

  const setTags = tags => {
    const value = state.workspace.committedBranch.lookup('document', 'value') || {}
    value.tags = tags
    state.workspace.commit(value, `knew ${selected.id}: ${knew}`).then(() => {
      state.ts = new Date()
      state.answerShown = null
    })
  }
  
  const historyToUrgency = history => {
    if (!history?.length) return Number.POSITIVE_INFINITY
    const lastAnswer = history[history.length - 1]
    let lastUnknownAnswer = history.findLast(({knew}) => !knew)
    if (!lastUnknownAnswer) {
      lastUnknownAnswer = {ts: new Date(history[0].ts.getTime() - 10000)}
    }
    const knownTime = Math.max(1000, lastAnswer.ts - lastUnknownAnswer.ts)
    const timePassed = state.ts - lastAnswer.ts
    if (timePassed > knownTime * 0.7) {
      if (timePassed / knownTime > 60) return -1
      return -Math.log(timePassed / knownTime)
    }
    return Math.log(knownTime / timePassed)
  }

  const displayHistory = history => {
    if (!history?.length) return
    const urgency = historyToUrgency(history)
    if (urgency < 0) {
      const percent = `${Math.min(100, -urgency * 5)}%`
      return h`
        <svg class="overdue" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="${percent}" height="100%"/>
        </svg>
      `
    } else {
      const percent = `${Math.min(100, urgency * 5)}%`
      return h`
        <svg class="notdue" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="${percent}" height="100%"/>
        </svg>
      `
    }
  }

  const getFilteredSortedQuestion = () => getQuestions()
    .map(question => Object.assign(question, { timeLeft: historyToUrgency(question.history) }))
    .filter(({tags}) => tags.some(tag => !state.tags[tag]))
    .sort((a, b) => a.timeLeft - b.timeLeft)

  const questionList = el => {
    const questions = getFilteredSortedQuestion()
    return h`
      <ol>
        ${questions.map(({text, id, history}) => {
          const showAnswer = (e, el) => { 
            state.ts = new Date()
            state.answerShown = id 
          }
          return h`
            <li>
              <button class=${historyToUrgency(history) === Number.POSITIVE_INFINITY ? 'disabled' : 'enabled'} onclick=${handle(showAnswer)}>${text}</button>
              ${displayHistory(history)}
            </li>
          `
        })}
      </ol>
    `
  }

  const clearFilters = (el, e) => {
    state.ts = new Date()
    for (const tag in state.tags) state.tags[tag] = false
  }

  const selectedState = el => {
    const questions = getFilteredSortedQuestion()
    if (!questions.length) {
      return h`
        <section id="answer" class="card" onclick=${handle(clearFilters)}>
          <div class="answer">👀</div>
          <div class="question">No questions found.</div>
        </section>
      `
    } else if (state.answerShown) {
      const selected = questions.find(q => q.id === state.answerShown)
      const hideAnswer = (e, el) => { 
        state.ts = new Date()
        state.answerShown = null
      }
      const addHistory = knew => {
        const questions = getQuestions()
        const selected = questions.find(q => q.id === state.answerShown)
        selected.history.push({knew, ts: new Date()})
        setQuestions(questions, `knew ${selected.id}: ${knew}`)
      }
      const stillLearningIt = (e, el) => addHistory(false)
      const knewIt = (e, el) => addHistory(true)
      return h`
        <section id="answer" class="card">
          <span class="closebutton" onclick=${handle(hideAnswer)}>✖</span>
          <div class="question">${selected?.text}</div>
          <div class="answer">${selected?.answer}</div>
          <div id="assessment">
            <button class="stilllearningit" onclick=${handle(stillLearningIt)}>still learning it</button>
            <button class="knewit" onclick=${handle(knewIt)}>knew it</button>
          </div>
        </section>
      `
    } else {
      const selected = questions[0]
      const showAnswer = (e, el) => {
        state.ts = new Date()
        state.answerShown = selected.id
      }
      return h`
        <section id="question" class="card" onclick=${handle(showAnswer)}>
          <div class="question">${selected.text}</div>
          <div class="answer">???</div>
        </section>
      `
    }
  }

  const tagChooser = el => {
    const tags = new Set(getQuestions().map(({tags}) => tags).flat())
    return [...tags].map(tag => {
      const toggleTag = (e, el) => {
        state.ts = new Date()
        state.tags[tag] = !state.tags[tag]
        state.answerShown = null
      }
      return h`
        <button class="tagtoggle toggle${(state.tags[tag] ? 'off' : 'on')}" onclick=${handle(toggleTag)}>${tag}</button>
      `
    })
  }

  const settings = el => {
    const signOut = (e, el) => {
      localStorage.clear()
      state.workspace = null
      state.answerShown = null
    }
    return h`
      <button class="signout" onclick=${handle(signOut)}>Sign Out</button>
    `
  }

  renderer = render(document.body, h`
    ${showIfElse(() => !!state.workspace, h`
      <header>
        ${settings}
      </header>
      ${selectedState}
      <details id="questions">
        <summary>Questions</summary>
        ${questionList}
      </details>
      <footer>
        ${tagChooser}
      </footer>
    `, h`
      <section id="signin">
        <h2>Sign In or Create Your Account</h2>
        <form onsubmit=${handle(signIn)}>
          <input type="text" name="username" placeholder="username" autocomplete="off" required autofocus />

          <input type="password" name="password" placeholder="password" autocomplete="off" required />

          <input type="submit" value="Summon Turtle" />

          <input type="checkbox" id="rememberme" name="rememberme"/>
          <label for="rememberme">remember me?</label>
        </form>
      </section>
    `)}
  `, recaller, 'home-body')
})
