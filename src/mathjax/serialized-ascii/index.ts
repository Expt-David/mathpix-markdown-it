import {MmlVisitor} from 'mathjax-full/js/core/MmlTree/MmlVisitor.js';
import {MmlNode, TextNode, XMLNode} from 'mathjax-full/js/core/MmlTree/MmlNode.js';

import { handle } from "./handlers";

export class SerializedAsciiVisitor extends MmlVisitor {
  options = null;

  constructor(options) {
    super();
    this.options = options
  }

  public visitTree(node: MmlNode) {
    return this.visitNode(node, '');
  }

  public visitTextNode(node: TextNode, space: string) {
    return node.getText();
  }

  public visitXMLNode(node: XMLNode, space: string) {
    return space + node.getSerializedXML();
  }

  public needsGrouping(element) {
    if (element.parent
      && (element.parent.kind === 'math' || element.parent.kind === 'mstyle'
        || element.parent.kind ==='mtable' || element.parent.kind ==='mtr' || element.parent.kind ==='mtd' || element.parent.kind ==='menclose')) {
      return false;
    }

    if (this.options.extraBrackets) {
      if (element.parent.parent && (element.parent.parent.kind === 'msup' || element.parent.parent.kind === 'msub'|| element.parent.parent.kind === 'msubsup'
        || element.parent.parent.kind === 'mover' || element.parent.parent.kind === 'munder'|| element.parent.parent.kind === 'munderover')) {
        return false;
      }
    }

    if (element.parent.kind === 'TeXAtom' && element.parent.parent.kind === 'inferredMrow') {
      return false;
    }

    if (element.childNodes && element.childNodes.length === 1) {
      if (element.childNodes[0].childNodes && element.childNodes[0].childNodes.length === 1) {
        return false;
      }
    }

    if (element.properties && element.properties.open === '(' && element.properties.close === ')') {
      return false;
    }
   const firstChild = element.childNodes[0];

    if (element.childNodes.length == 1 && firstChild.kind == 'mtext') {
      return false;
    }

    return true;
  }

  public needsGroupingStyle(element) {
    if (element.childNodes.length < 2) { return null }
    let firstChild = element.childNodes[0];
    let firstAtr = this.getAttributes(firstChild);
    if (!firstAtr || !firstAtr.mathvariant || !firstAtr.hasOwnProperty('mathvariant')) { return null }

    for (let i = 1; i< element.childNodes.length; i++) {
      let atr = this.getAttributes(element.childNodes[i]);
      if (!atr || atr.mathvariant !== firstAtr.mathvariant ) {
        return null
      }
    }
    return firstAtr;
  }

  public visitInferredMrowNode(node: MmlNode, space: string) {
    let mml = [];
    const iclose: number = node.childNodes.findIndex(child => child.kind === 'menclose');
    if (iclose > -1) {
      const mclose: any = node.childNodes[iclose];
      const atr = this.getAttributes(mclose);
      const atrDef = this.getAttributesDefaults(mclose);
      let longdiv = '';
      if ((!atr.notation && atrDef.notation === "longdiv") || atr.notation.toString().indexOf("longdiv") !== -1) {
        if (iclose === 0) {
          longdiv += '(()/(';
          longdiv += this.visitNode(mclose, '');
          longdiv += '))';
        } else {
          if (iclose-1 > 0) {
            for (let i = 0; i < iclose-1; i++) {
              longdiv += this.visitNode(node.childNodes[i], space);
            }
          }
          longdiv += '((';
          const firstChild = node.childNodes[iclose-1];
          longdiv += this.visitNode(firstChild, '');
          longdiv += ')/(';
          longdiv += this.visitNode(mclose, '');
          longdiv += '))';

          if (iclose < node.childNodes.length-1) {
            for (let i = iclose+1; i < node.childNodes.length; i++) {
              longdiv += this.visitNode(node.childNodes[i], space);
            }
          }
        }
        mml.push(longdiv);
        return mml.join('');
      }
    }

    const addParens = this.needsGrouping(node);
    const group = addParens ? this.needsGroupingStyle(node) : null;

    if (addParens && !group) {
      mml.push('(')
    }
    for (const child of node.childNodes) {
      mml.push(this.visitNode(child, space));
    }
    if (addParens&& !group) {
      mml.push(')')
    }
    return mml.join('');
  }

  public visitTeXAtomNode(node: MmlNode, space: string) {
    let children = this.childNodeMml(node, space + '  ', '\n');

    let mml =
      (children.match(/\S/) ? children : '');
    return mml;
  }


  public visitAnnotationNode(node: MmlNode, space: string) {
    return space + '<annotation' + this.getAttributes(node) + '>'
      + this.childNodeMml(node, '', '')
      + '</annotation>';
  }

  public visitDefault(node: MmlNode, space: string) {
    return  this.childNodeMml(node,  '  ', '')
  }

  protected childNodeMml(node: MmlNode, space: string, nl: string) {
    const handleCh = handle.bind(this);
    let mml = '';
    if (node.kind === 'mover' && node.childNodes.length > 1 && node.childNodes[0].kind === 'TeXAtom' && node.childNodes[1].kind === 'TeXAtom') {
      const firstChild: any = node.childNodes[0];
      firstChild.properties.needBrackets = true;
      mml += handleCh(firstChild, this);
      mml += '^';
      mml += '(' + handleCh(node.childNodes[1], this) + ')';
    } else {
      mml += handleCh(node, this);
    }

    return mml;
  }

  protected getAttributes(node: MmlNode) {
    return node.attributes.getAllAttributes();
  }
  protected getAttributesDefaults(node: MmlNode) {
    return node.attributes.getAllDefaults();
  }
}
