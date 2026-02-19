# Lincohl Knowledge Base

Lincoln primary sources for grounding the Lincohl voice assistant in authentic speech patterns and wisdom.

## Files

| File | Content | Size |
|------|---------|------|
| `lincoln_primary_sources.txt` | Gettysburg Address, Second Inaugural, Farewell at Springfield, Letter to Greeley, 25+ verified quotes | ~12KB |

## Upload to ElevenLabs

Using the RAG manager:

```bash
cd lincohl/shared
python rag_manager.py upload ../shared/kb/lincoln_primary_sources.txt
```

Or via the ElevenLabs API directly:

```bash
curl -X POST "https://api.elevenlabs.io/v1/convai/knowledge-base/file" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -F "file=@kb/lincoln_primary_sources.txt" \
  -F "name=Lincoln Primary Sources"
```

After uploading, associate the document with the agent by PATCHing the agent config to include the document ID in `conversation_config.agent.prompt.knowledge_base`.

## Sources

All texts are public domain (pre-1928 US works):

- **Project Gutenberg** — gutenberg.org
- **Avalon Project, Yale Law School** — avalon.law.yale.edu
- **Abraham Lincoln Online** — abrahamlincolnonline.org

## Future Additions

- House Divided Speech (1858) — long, would benefit from a separate file
- First Inaugural Address (1861) — long, separate file recommended
- Cooper Union Address (1860)
- Emancipation Proclamation (1863)
- Bixby Letter (1864)
- Team of Rivals excerpts (Doris Kearns Goodwin) — may have copyright restrictions
