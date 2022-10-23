importScripts("https://cdn.jsdelivr.net/pyodide/v0.21.3/full/pyodide.js");

function sendPatch(patch, buffers, msg_id) {
  self.postMessage({
    type: 'patch',
    patch: patch,
    buffers: buffers
  })
}

async function startApplication() {
  console.log("Loading pyodide!");
  self.postMessage({type: 'status', msg: 'Loading pyodide'})
  self.pyodide = await loadPyodide();
  self.pyodide.globals.set("sendPatch", sendPatch);
  console.log("Loaded!");
  await self.pyodide.loadPackage("micropip");
  const env_spec = ['https://cdn.holoviz.org/panel/0.14.0/dist/wheels/bokeh-2.4.3-py3-none-any.whl', 'https://cdn.holoviz.org/panel/0.14.0/dist/wheels/panel-0.14.0-py3-none-any.whl', 'pandas', 'requests']
  for (const pkg of env_spec) {
    const pkg_name = pkg.split('/').slice(-1)[0].split('-')[0]
    self.postMessage({type: 'status', msg: `Installing ${pkg_name}`})
    await self.pyodide.runPythonAsync(`
      import micropip
      await micropip.install('${pkg}');
    `);
  }
  console.log("Packages loaded!");
  self.postMessage({type: 'status', msg: 'Executing code'})
  const code = `
  
import asyncio

from panel.io.pyodide import init_doc, write_doc

init_doc()

#!/usr/bin/env python
# coding: utf-8

# In[ ]:


import panel as pn
import requests
import pandas as pd
pn.extension()


# In[ ]:


def get_data(num_questions, difficulty, category):
    url = f"https://opentdb.com/api.php?amount={num_questions}&category={category_match[category]}&difficulty={difficulty}&type=boolean"
    df = pd.DataFrame(
        requests.get(url).json()['results']
    )
    return df 


# In[ ]:


category = pn.widgets.Select(
    name='Category',
    options=[
        'General Knowledge',
        'Film',
        'Music',
        'Video Games',
        'Science & Nature',
        'Computers',
        'Geography',
        'History',
        'Politics',
        'Animals',
        'Japanese Anime & Manga'
    ], 
    value='General Knowledge'
)
category


# In[ ]:


category_match = {
   'General Knowledge': 9,
   'Books': 10,
   'Film': 11,
   'Music': 12,
   'Musicals & Theatres': 13,
   'Television': 14,
   'Video Games': 15,
   'Board Games': 16,
   'Science & Nature': 17,
   'Computers': 18,
   'Mathematics': 19,
   'Mythology': 20,
   'Sports': 21,
   'Geography': 22,
   'History': 23,
   'Politics': 24,
   'Art': 25,
   'Celebrities': 26,
   'Animals': 27,
   'Vehicles': 28,
   'Comics': 29,
   'Gadgets': 30,
   'Japanese Anime & Manga': 31,
   'Cartoon & Animations': 32
}


# In[ ]:


difficulty = pn.widgets.Select(
    name='Difficulty',
    options=['easy', 'medium', 'hard'], 
    value='easy'
)
difficulty


# In[ ]:


num_questions = pn.widgets.DiscreteSlider(
    name='Number of Questions', 
    options=[5, 10, 15, 20], value=5
)
num_questions


# In[ ]:


def question_list(i, df):

    button_true = pn.widgets.Button(name='True')
    button_false = pn.widgets.Button(name='False')
 
    text = pn.widgets.StaticText(value='')

    def processing_button_true(event):
        if df.correct_answer[i] == 'True': 
            text.value = 'Correct!'
        else:
            text.value = 'Incorrect!'

    def processing_button_false(event):
        if df.correct_answer[i] == 'False': 
            text.value = 'Correct!'
        else:
            text.value = 'Incorrect!'

    button_true.on_click(processing_button_true)
    button_false.on_click(processing_button_false)
    return pn.Column(
        pn.pane.Markdown(f"""
        &nbsp;
        #Question {i+1}:
        ### {df.question[i]}
        """),

        pn.Row(button_true,button_false), 
        text)


# In[ ]:


def get_data_and_questions(num_questions, difficulty, category):
    df = get_data(num_questions, difficulty, category)
    question_pane = [question_list(i, df) for i in range(len(df))]
    trivia_pane = pn.Column(*question_pane)
    return trivia_pane 


# In[ ]:


interactive = pn.bind(get_data_and_questions, num_questions, difficulty, category)


# In[ ]:


# Layout using Template
template = pn.template.FastListTemplate(
    title='Trivia Game', 
    sidebar=[num_questions, difficulty, category],
    main=[interactive],
    accent_base_color="#88d8b0",
    header_background="#88d8b0",
)
template.servable()


# In[ ]:






await write_doc()
  `
  const [docs_json, render_items, root_ids] = await self.pyodide.runPythonAsync(code)
  self.postMessage({
    type: 'render',
    docs_json: docs_json,
    render_items: render_items,
    root_ids: root_ids
  });
}

self.onmessage = async (event) => {
  const msg = event.data
  if (msg.type === 'rendered') {
    self.pyodide.runPythonAsync(`
    from panel.io.state import state
    from panel.io.pyodide import _link_docs_worker

    _link_docs_worker(state.curdoc, sendPatch, setter='js')
    `)
  } else if (msg.type === 'patch') {
    self.pyodide.runPythonAsync(`
    import json

    state.curdoc.apply_json_patch(json.loads('${msg.patch}'), setter='js')
    `)
    self.postMessage({type: 'idle'})
  } else if (msg.type === 'location') {
    self.pyodide.runPythonAsync(`
    import json
    from panel.io.state import state
    from panel.util import edit_readonly
    if state.location:
        loc_data = json.loads("""${msg.location}""")
        with edit_readonly(state.location):
            state.location.param.update({
                k: v for k, v in loc_data.items() if k in state.location.param
            })
    `)
  }
}

startApplication()