from lxml import etree

def parse_xml_upload(xml_content):
    # Vulnerable: Parsing XML without disabling external entities (XXE)
    parser = etree.XMLParser(resolve_entities=True)
    tree = etree.fromstring(xml_content, parser)
    
    return tree.tag
