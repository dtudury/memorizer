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

  const getQuestions = () => state.workspace?.committedBranch?.lookup?.('document', 'value', 'questions') || 
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
    assignValueObject({questions}, message)
  }

  const getTags = () => state.workspace?.committedBranch?.lookup?.('document', 'value', 'tags') ||
    new Set(['Abbreviations', 'Multiplication'])

  const setTags = tags => {
    assignValueObject({tags}, 'setTags')
  }

  const getCardState = () => state.workspace?.committedBranch?.lookup?.('document', 'value', 'cardState') || {}

  const setCardState = cardState => {
    assignValueObject({cardState}, 'setCardState')
  }

  const assignValueObject = (obj, message) => {
    const value = state.workspace?.committedBranch.lookup('document', 'value') || {}
    Object.assign(value, obj)
    state.workspace.commit(value, message).then(() => {
      state.ts = new Date()
    })
  }
  
  const parseHistory = history => {
    if (!history?.length) return { urgency: Number.POSITIVE_INFINITY, t: Number.POSITIVE_INFINITY }
    const lastAnswer = history[history.length - 1]
    let lastUnknownAnswer = history.findLast(({knew}) => !knew)
    if (!lastUnknownAnswer) {
      lastUnknownAnswer = {ts: new Date(history[0].ts.getTime() - 10000)}
    }
    const knownTime = Math.max(1000, lastAnswer.ts - lastUnknownAnswer.ts)
    const timePassed = state.ts - lastAnswer.ts
    let t = knownTime * 0.7 - timePassed
    if (timePassed > knownTime * 0.7) {
      if (timePassed / knownTime > 60) return { urgency: -1, t }
      return { urgency: -Math.log(1 + timePassed / knownTime), t }
    }
    return { urgency: Math.log(1 + knownTime / timePassed), t }
  }

  const displayHistory = history => {
    if (!history?.length) return
    const { urgency } = parseHistory(history)
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

  const displayT = t => {
    if (t === Number.POSITIVE_INFINITY) return ''
    t = Math.abs(t)
    let s = Math.floor(t / 1000)
    let m = Math.floor(s / 60)
    if (!m) return `${s} second${s !== 1 ? 's' : ''}`
    s = (s % 60).toString().padStart(2, '0')
    let h = Math.floor(m / 60)
    if (!h) return `${m} minute${m !== 1 ? 's' : ''}`
    m = (m % 60).toString().padStart(2, '0')
    let d = Math.floor(h / 24)
    if (!d) return `${h} hour${h !== 1 ? 's' : ''}`
    h = (h % 60).toString().padStart(2, '0')
    h %= 24
    return `${d} day${d !== 1 ? 's' : ''}`
  }

  const getFilteredSortedQuestion = () => {
    const savedTags = getTags()
    return getQuestions()
      .map(question => Object.assign(question, parseHistory(question.history)))
      .filter(({tags}) => tags.some(tag => !savedTags.has(tag)))
      .sort((a, b) => a.t - b.t)
  }

  const questionList = el => {
    const questions = getFilteredSortedQuestion()
    return h`
      <ol>
        ${questions.map(({text, id, history, t}) => {
          const showCard = (e, el) => { 
            state.ts = new Date()
            setCardState({ id })
          }
          return h`
            <li>
              <button 
                class="${t === Number.POSITIVE_INFINITY ? 'disabled' : 'enabled'} ${t <= 0 ? 'expired' : 'unexpired'}"
                onclick=${handle(showCard)}
              >
                ${text}
                <span class="time">${displayT(t)}</span>
                ${displayHistory(history)}
              </button>
            </li>
          `
        })}
      </ol>
    `
  }

  const clearFilters = (el, e) => {
    state.ts = new Date()
    setTags(new Set())
  }

  const flashCard = el => {
    const questions = getFilteredSortedQuestion()
    console.log(state.workspace?.index, questions)
    if (!questions.length) {
      return h`
        <section id="answer" class="card" onclick=${handle(clearFilters)}>
          <div class="answer">👀</div>
          <div class="question">No questions found.</div>
        </section>
      `
    } 
    const cardState = getCardState()
    if (cardState.id && cardState.answerShown) {
      const selected = questions.find(q => q.id === cardState.id)
      const hideAnswer = (e, el) => { 
        state.ts = new Date()
        setCardState({})
      }
      const addHistory = knew => {
        const questions = getQuestions()
        const selected = questions.find(q => q.id === cardState.id)
        selected.history.push({knew, ts: new Date()})
        assignValueObject({questions, cardState: {}}, `knew ${selected.id}: ${knew}`)
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
    }
    let id = cardState.id
    if(!id) {
      const nextQuestion = questions[0]
      const history = nextQuestion.history ?? []
      if (nextQuestion.urgency <= 0 || history[history.length - 1]?.knew === false) {
        id = nextQuestion.id
      } else {
        const nextUnknown = questions.find(({history}) => parseHistory(history).t === Number.POSITIVE_INFINITY)
        const nextCard = (e, el) => { 
          state.ts = new Date()
          setCardState({ id: nextQuestion.id })
        }
        const newCard = (e, el) => { 
          state.ts = new Date()
          setCardState({ id: nextUnknown.id })
        }
        return h`
          <section id="question" class="card">
            <div class="answer">🎉 You did it! 🎉</div>
            <div class="cardoption">
              Next card:
              <button class=${parseHistory(nextQuestion.history).t === Number.POSITIVE_INFINITY ? 'disabled' : 'enabled'} onclick=${handle(nextCard)}>
                ${nextQuestion.text}
                <span class="time">${displayT(nextQuestion.t)}</span>
                ${displayHistory(nextQuestion.history)}
              </button>
            </div>
            <div class="cardoption">
              New card:
              <button class=${parseHistory(nextUnknown?.history).t === Number.POSITIVE_INFINITY ? 'disabled' : 'enabled'} onclick=${handle(newCard)}>
                ${nextUnknown?.text}
                <span class="time">${displayT(nextUnknown?.t)}</span>
                ${displayHistory(nextUnknown?.history)}
              </button>
            </div>
          </section>
        `
      }
    }

    const selected = questions.find(q => q.id === id)
    console.log(id, selected, questions)
    const showAnswer = (e, el) => {
      state.ts = new Date()
      setCardState({id, answerShown: true})
    }
    return h`
      <section id="question" class="card" onclick=${handle(showAnswer)}>
        <div class="question">${selected.text}</div>
        <div class="answer">???</div>
      </section>
    `
  }

  const tagChooser = el => {
    const tags = new Set(getQuestions().map(({tags}) => tags).flat())
    return [...tags].map(tag => {
      const toggleTag = (e, el) => {
        state.ts = new Date()
        const savedTags = getTags()
        if (savedTags.has(tag)) savedTags.delete(tag)
        else savedTags.add(tag)
        setTags(savedTags)
      }
      return h`
        <button class="tagtoggle toggle${(getTags().has(tag) ? 'off' : 'on')}" onclick=${handle(toggleTag)}>${tag}</button>
      `
    })
  }

  const settings = el => {
    const signOut = (e, el) => {
      localStorage.clear()
      state.workspace = null
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
      ${flashCard}
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
