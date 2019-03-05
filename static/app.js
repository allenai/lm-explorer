const Wrapper = styled.div`
  color: #232323;
  border-top: 4px solid #fcb431;
  max-width: 940px;
  flex-grow: 1;
  margin: 2rem;
  background: #fff;
  padding: 2rem;
  font-size: 1em;
  box-shadow: 1px 1px 3px rgba(0,0,0,0.3);
  font-size: 1em;
  line-height: 1.4;

  @media(max-width: 500px) {
    margin: 0;
  }
`

const Title = styled.h1`
  font-size: 1.5em;
  margin: 0 0 1rem;
  display: flex;
  align-items: center;
  flex-wrap: wrap;

  @media(max-width: 500px) {
    justify-content: center;
  }
`

const AppName = styled.span`
  background: #2085bc;
  font-weight: 200;
  color: #fff;
  padding: 0.5rem 1rem;
  line-height: 1;
  border-radius: 2rem;
  margin-left: auto;

  @media(max-width: 500px) {
    margin: 1rem 0 0;
  }
`

const LinkHome = styled.a`
  background-image: url('static/ai2-logo-header.png');
  background-size: 360px 71px;
  backround-repeat: no-repeat;
  width: 360px;
  height: 71px;
  display: block;
  margin: 0 1rem 0 0;

  @media(max-width: 500px) {
    background-image: url('static/ai2-logo-header-crop.png');
    background-size: 89px 71px;
    width: 89px;
    height: 71px;
  }
`

const Intro = styled.div`
  margin: 2em 0;

  @media(max-width: 500px) {
    font-size: 0.8em;
  }
`

const TextInputWrapper = styled.div`
  position: relative;
`

const Loading = styled.div`
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  font-size: 0.8em;
  color: #8c9296;
`

const LoadingText = styled.div`
  padding-left: 0.5rem;
`

const TextInput = styled.textarea`
  display: block;
  width: 100%;
  font-size: 1.25em;
  min-height: 100px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  box-shadow: inset 1px 1px 4px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  border-radius: 0.25rem;
`

const Button = styled.button`
  color: #fff!important;
  background: #2085bc;
`

const ListItem = styled.li`
  margin: 0 0 0.5rem;
`

const ChoiceList = styled.ul`
  padding: 0;
  margin: 2rem 1rem 1rem 1rem;
  flex-wrap: wrap;
  list-style-type: none;
`

const ChoiceItem = styled.button`
  color: #2085bc;
  cursor: pointer;
  background: transparent;
  display: inline-flex;
  align-items: center;
  line-height: 1;
  font-size: 1.15em;
  border: none;
  border-bottom: 2px solid transparent;
`

const UndoButton = styled(ChoiceItem)`
  color: #8c9296;
`

const Probability = styled.span`
  color: #8c9296;
  margin-right: 0.5rem;
  font-size: 0.8em;
  min-width: 4em;
  text-align: right;
`

const Token = styled.span`
  font-weight: 600;
`

const OutputSentence = styled.div`
  margin: 20px;
  font-family: monospace;
  flex: 1;
`

const OutputToken = styled.span`
  cursor: pointer;

  :hover {
      font-weight: bold;
  }
`

const VR = styled.div`
  border-left: 1px solid lightgray;
  margin: 10px;
  height: 200px;
`

const OutputSpace = styled.span`
`

const Footer = styled.div`
  margin: 2rem 0 0 0;
`

const DEFAULT = "Joel is";

function addToUrl(output, choice) {
  if ('history' in window) {
    window.history.pushState(null, null, '?text=' + encodeURIComponent(output + (choice || '')))
  }
}

function loadFromUrl() {
  const params =
      document.location.search.substr(1).split('&').map(p => p.split('='));
  const text = params.find(p => p[0] === 'text');
  return Array.isArray(text) && text.length == 2 ?  decodeURIComponent(text.pop()) : null;
}

class App extends React.Component {

  constructor(props) {
    super(props)

    this.state = {
      output: loadFromUrl() || DEFAULT,
      words: null,
      logits: null,
      probabilities: null,
      loading: false
    }

    this.choose = this.choose.bind(this)
    this.debouncedChoose = _.debounce(this.choose, 1000)
    this.setOutput = this.setOutput.bind(this)
    this.runOnEnter = this.runOnEnter.bind(this)
    this.predict = this.predict.bind(this)
  }

  setOutput(evt) {
    const value = evt.target.value
    this.setState({
        output: value,
        words: null,
        logits: null,
        probabilities: null,
        loading: true
    })
    this.debouncedChoose()
  }

  predict(start) {
    this.setState({loading: true})
    const payload = {
        "previous": start
    }
    const endpoint = '/predict'
    fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
      })
      .then(response => response.json())
      .then(data => this.setState({...data, loading: false}))
  }

  componentDidMount() {
    this.choose()
    if ('history' in window) {
      window.addEventListener('popstate', () => {
        const fullText = loadFromUrl();
        const doNotChangeUrl = fullText ? true : false;
        const output = fullText || DEFAULT;
        this.setState({
          output,
          loading: true,
          words: null,
          logits: null,
          probabilities: null
        }, () => this.choose(undefined, doNotChangeUrl));
      })
    }
  }

  choose(choice = undefined, doNotChangeUrl) {
    this.setState({loading: true})
    const payload = {
        "previous": this.state.output,
        "next": choice,
        "numsteps": 5
        // "numsteps": 3
    }

    const endpoint = '/predict'
    // const endpoint = '/beam'
    //const endpoint = '/random'

    if ('history' in window && !doNotChangeUrl) {
      addToUrl(this.state.output, choice);
    }
    gtag('config', window.googleUA, {
      page_location: document.location.toString()
    });

    fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => this.setState({...data, loading: false}))
  }

  // Temporarily (?) disabled
  runOnEnter(e) {
    if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        this.choose()
    }
  }

  render() {
    return (
      <Wrapper>
        <Title>
          <LinkHome href="https://allenai.org" target="_blank"></LinkHome>
          <AppName>GPT-2 Explorer</AppName>
        </Title>
        <Intro>
          This is a demonstration of using the <a href="https://github.com/openai/gpt-2" target="_blank">OpenAI GPT-2</a> language model
          to generate text.<br /><br />
          Enter some initial text and the model will generate the most likely next words.
          You can click on one of those words to choose it and continue or just keep typing.
          Click the left arrow at the bottom to undo your last choice.
        </Intro>
        {/*onKeyDown={this.state.output ? this.runOnEnter : null} */ }
        <TextInputWrapper>
          <TextInput type="text"
                     value={this.state.output}
                     onChange={this.setOutput}/>
          {this.state.loading ? (
            <Loading>
              <img src="/static/loading-bars.svg" width="25" height="25" />
              <LoadingText>Loading</LoadingText>
            </Loading>
          ) : null}
        </TextInputWrapper>
        <Choices predict={this.predict}
                  output={this.state.output}
                  choose={this.choose}
                  logits={this.state.logits}
                  words={this.state.words}
                  probabilities={this.state.probabilities}
                  hidden={this.state.loading}/>
        { /* <Button onClick={() => this.choose()}>predict</Button> */ }
        {/*<Output text={this.state.output} predict={this.predict}/>*/}
        <Footer>
          Built at the <a href="https://allenai.org" target="_blank">Allen Institute for Artificial Intelligence</a>
          {' '}using Hugging Face’s <a href="https://github.com/huggingface/pytorch-pretrained-BERT" target="_blank">pytorch-pretrained-BERT</a>
          {' '}library.
        </Footer>
      </Wrapper>
    )
  }
}

const Output = ({text, predict}) => {
  const tokens = text.split(" ")
  const words = []
  let prefix = ""

  const click = start => () => predict(start)

  tokens.forEach((token, idx) => {
    prefix += token
    words.push(
        <OutputToken onClick={click(prefix)} key={`${idx}-${token}`}>{token}</OutputToken>)
    prefix += " "
    words.push(<OutputSpace key={`${idx}-whitespace`}>{' '}</OutputSpace>)
  })

  return <OutputSentence>{words}</OutputSentence>
}

const formatProbability = prob => {
  prob = prob * 100
  return `${prob.toFixed(1)}%`
}

const Choices = ({output, predict, logits, words, choose, probabilities}) => {
  if (!words) { return null }

  const lis = words.map((word, idx) => {
      const logit = logits[idx]
      const prob = formatProbability(probabilities[idx])

      // get rid of CRs
      word = word.replace(/\n/g, "↵")

      return (
        <ListItem key={`${idx}-${word}`}>
          <ChoiceItem onClick={() => choose(word)}>
            <Probability>{prob}</Probability>
            {' '}
            <Token>{word}</Token>
          </ChoiceItem>
        </ListItem>
      )
  })

const goBack = () => {
  const lastSpace = output.lastIndexOf(" ")
    let prefix = ""
    if (lastSpace > 0) {
      prefix = output.slice(0, lastSpace)
    }
    predict(prefix)
  }

  const goBackItem = (
    <ListItem key="go-back">
      <UndoButton onClick={goBack}>
        <Probability>←</Probability>
        {' '}
        <Token>Undo</Token>
      </UndoButton>
    </ListItem>
  )

  return (
    <ChoiceList>
      {lis}
      {goBackItem}
    </ChoiceList>
  )
}



ReactDOM.render(<App />, document.getElementById("app"))