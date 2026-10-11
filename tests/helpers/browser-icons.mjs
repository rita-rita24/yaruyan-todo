// Serialized into browser QA: canonical shapes remain the source of truth for either SVG representation.
export function svgShapeMatches(svg, token) {
  const symbol = document.getElementById(`icon-${token}`);
  if (
    !svg ||
    !symbol ||
    svg.localName !== 'svg' ||
    svg.getAttribute('viewBox') !== symbol.getAttribute('viewBox')
  )
    return false;
  const use = svg.querySelector('use');
  if (use)
    return (
      svg.children.length === 1 && use.getAttribute('href') === `#icon-${token}`
    );
  return (
    svg.children.length === symbol.children.length &&
    [...svg.children].every((child, index) =>
      child.isEqualNode(symbol.children[index]),
    )
  );
}
