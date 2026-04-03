<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <html>
      <head>
        <title>Rohan's Web RSS</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #f8fafc; padding: 50px; }
          .feed-container { max-width: 900px; margin: auto; }
          header { border-bottom: 4px solid #38bdf8; padding-bottom: 20px; margin-bottom: 40px; }
          h1 { font-size: 3em; margin: 0; color: #38bdf8; }
          .item { background: #1e293b; padding: 25px; border-radius: 15px; margin-bottom: 25px; border-left: 5px solid #38bdf8; transition: 0.3s; }
          .item:hover { transform: translateX(10px); background: #334155; }
          .tag { background: #38bdf8; color: #0f172a; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 0.8em; text-transform: uppercase; }
          h2 a { color: #f8fafc; text-decoration: none; font-size: 1.5em; display: block; margin-top: 10px; }
          .date { color: #94a3b8; font-size: 0.9em; margin: 10px 0; }
          .desc { line-height: 1.6; color: #cbd5e1; }
        </style>
      </head>
      <body>
        <div class="feed-container">
          <header>
            <h1>Rohan's Web News</h1>
            <p>Official Updates &amp; Project Releases</p>
          </header>
          <xsl:for-each select="rss/channel/item">
            <div class="item">
              <span class="tag"><xsl:value-of select="category"/></span>
              <h2><a href="{link}"><xsl:value-of select="title"/></a></h2>
              <div class="date"><xsl:value-of select="pubDate"/></div>
              <p class="desc"><xsl:value-of select="description"/></p>
            </div>
          </xsl:for-each>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>