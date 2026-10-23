"""Run with: py -m streamlit run streamlit_app.py."""

from pathlib import Path
from tempfile import TemporaryDirectory

import streamlit as st
import streamlit.components.v1 as components


ROOT = Path(__file__).resolve().parent


def build_dashboard() -> str:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    javascript = (ROOT / "app.js").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="styles.css">', f"<style>{css}</style>")
    html = html.replace('<script src="app.js" defer></script>', "")
    bridge = """
    <script>
      parent.postMessage({
        isStreamlitMessage: true,
        type: "streamlit:componentReady",
        apiVersion: 1
      }, "*");
      function resizeDashboard() {
        parent.postMessage({
          isStreamlitMessage: true,
          type: "streamlit:setFrameHeight",
          height: Math.ceil(document.body.getBoundingClientRect().height) + 8
        }, "*");
      }
      new ResizeObserver(resizeDashboard).observe(document.body);
      addEventListener("load", resizeDashboard);
      resizeDashboard();
    </script>
    """
    return html.replace("</body>", f"<script>{javascript}</script>{bridge}</body>")


@st.cache_resource
def prepare_component(html: str):
    directory = TemporaryDirectory(prefix="la-gran-espera-")
    (Path(directory.name) / "index.html").write_text(html, encoding="utf-8")
    component = components.declare_component("la_gran_espera", path=directory.name)
    return directory, component


def main() -> None:
    st.set_page_config(
        page_title="La gran espera · Quiniela del bebé",
        page_icon="✨",
        layout="wide",
        initial_sidebar_state="collapsed",
    )
    st.markdown(
        """
        <style>
          .stApp { background: #f6f4ee; }
          [data-testid="stMainBlockContainer"] {
            max-width: none; padding: 0 0 1rem;
          }
          [data-testid="stHeader"] { background: transparent; }
        </style>
        """,
        unsafe_allow_html=True,
    )
    directory, dashboard = prepare_component(build_dashboard())
    dashboard(key="baby-dashboard", default=None)


if __name__ == "__main__":
    main()
