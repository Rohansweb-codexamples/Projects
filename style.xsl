<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:template match="/">
<html>
<head>
    <title>Rohan's Web | 80-Item Master Feed</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #0d1117; color: #c9d1d9; padding: 40px; }
        .container { max-width: 1000px; margin: auto; }
        header { border-bottom: 3px solid #58a6ff; padding-bottom: 20px; margin-bottom: 40px; text-align: center; }
        h1 { color: #58a6ff; font-size: 3rem; margin: 0; text-transform: uppercase; letter-spacing: 4px; }
        .item { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 30px; margin-bottom: 40px; transition: 0.3s; }
        .item:hover { border-color: #58a6ff; box-shadow: 0 0 15px rgba(88, 166, 255, 0.2); }
        .category-tag { background: #238636; color: white; padding: 5px 15px; border-radius: 50px; font-size: 0.7rem; font-weight: bold; float: right; }
        h2 a { color: #58a6ff; text-decoration: none; font-size: 1.8rem; }
        .date { color: #8b949e; font-size: 0.85rem; margin: 10px 0; font-style: italic; }
        .content p { line-height: 1.8; margin-bottom: 20px; font-size: 1.1rem; }
        .footer-link { display: inline-block; margin-top: 10px; color: #1f6feb; font-weight: bold; text-decoration: none; border: 1px solid #1f6feb; padding: 5px 15px; border-radius: 6px; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Rohan's Web Master Feed</h1>
            <p>Displaying 80 Professional Updates &amp; Logs</p>
        </header>
        <xsl:for-each select="rss/channel/item">
            <div class="item">
                <span class="category-tag"><xsl:value-of select="category"/></span>
                <h2><a href="{link}"><xsl:value-of select="title"/></a></h2>
                <div class="date"><xsl:value-of select="pubDate"/></div>
                <div class="content"><xsl:value-of select="description" disable-output-escaping="yes"/></div>
                <a class="footer-link" href="{link}">Visit Resource</a>
            </div>
        </xsl:for-each>
    </div>
</body>
</html>
</xsl:template>
</xsl:stylesheet>