from browser_use import Agent
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini")

async def run_browser_agent(task: str):
    """
    Runs the browser agent and returns its results in a JSON-serializable format.
    """
    agent = Agent(task=task, llm=llm, use_vision=True, max_failures=3, retry_delay=5)
    history = await agent.run(max_steps=50)

    serialized_results = []
    if history and history.history:
        for step in history.history:
            if step.result:
                if isinstance(step.result, list):
                    for res in step.result:
                        serialized_results.append(vars(res))
                else:
                    serialized_results.append(vars)

    return serialized_results
