import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, X, User, Building, Mail, Phone, MapPin, Smartphone, HelpCircle, Search } from 'lucide-react';

export default function NetworkGraph({ cards }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedCompanyContacts, setSelectedCompanyContacts] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHelp, setShowHelp] = useState(true);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || cards.length === 0) return;

    // 1. Process data for D3
    const companyNodesMap = new Map();
    const contactNodes = [];
    const links = [];

    // Identify all unique companies and map contacts
    cards.forEach(card => {
      const company = (card.company_name || 'Independent').trim();
      if (!companyNodesMap.has(company)) {
        companyNodesMap.set(company, {
          id: `company_${company}`,
          label: company,
          type: 'company',
          count: 0
        });
      }
      companyNodesMap.get(company).count += 1;

      const contactId = `contact_${card.id}`;
      contactNodes.push({
        id: contactId,
        label: card.person_name,
        type: 'contact',
        company: company,
        designation: card.designation,
        card: card
      });

      links.push({
        source: `company_${company}`,
        target: contactId
      });
    });

    const nodes = [...companyNodesMap.values(), ...contactNodes];

    // 2. Setup Dimensions
    const width = containerRef.current.clientWidth || 400;
    const height = 550;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .style('cursor', 'grab');

    // Clear previous renders
    svg.selectAll('*').remove();

    // Create container for zoom/pan
    const g = svg.append('g').attr('class', 'graph-content');

    // Setup zoom behaviors
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Initial center zoom
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8));

    // Define color scales
    const companyColor = '#6366f1'; // Indigo
    const contactColor = '#10b981'; // Emerald

    // 3. Force Simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(60))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('collide', d3.forceCollide().radius(d => d.type === 'company' ? 30 : 20))
      .force('center', d3.forceCenter(0, 0).strength(0.05));

    // 4. Render Links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6);

    // 5. Render Node Groups
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.type === 'contact') {
          setSelectedCompanyContacts(null);
          setSelectedCard(d.card);
        } else {
          // Company node clicked - list company contacts
          const companyContacts = cards.filter(c => (c.company_name || 'Independent').trim() === d.label);
          setSelectedCard(null);
          setSelectedCompanyContacts({ name: d.label, contacts: companyContacts });
        }
      });

    // 6. Append circles based on type
    node.each(function(d) {
      const el = d3.select(this);
      
      if (d.type === 'company') {
        // Company Node: Outer glow + circle
        el.append('circle')
          .attr('r', 16 + Math.min(d.count * 1.5, 12)) // Scale radius slightly with contact count
          .attr('fill', 'url(#companyGradient)')
          .attr('stroke', companyColor)
          .attr('stroke-width', 2)
          .attr('filter', 'url(#glow)');
      } else {
        // Contact Node
        el.append('circle')
          .attr('r', 10)
          .attr('fill', 'url(#contactGradient)')
          .attr('stroke', contactColor)
          .attr('stroke-width', 1.5);
      }
    });

    // 7. Append Labels
    node.append('text')
      .attr('dy', d => d.type === 'company' ? 26 : 18)
      .attr('text-anchor', 'middle')
      .attr('fill', '#e2e8f0')
      .attr('font-size', d => d.type === 'company' ? '10px' : '9px')
      .attr('font-weight', d => d.type === 'company' ? 'bold' : 'normal')
      .text(d => d.label)
      .clone(true).lower()
      .attr('fill', 'none')
      .attr('stroke', '#020617')
      .attr('stroke-width', 3);

    // 8. Add SVG Gradients and Filters
    const defs = svg.append('defs');

    // Company Gradient
    const compGrad = defs.append('linearGradient').attr('id', 'companyGradient').attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
    compGrad.append('stop').attr('offset', '0%').attr('stop-color', '#818cf8');
    compGrad.append('stop').attr('offset', '100%').attr('stop-color', '#4f46e5');

    // Contact Gradient
    const contGrad = defs.append('linearGradient').attr('id', 'contactGradient').attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
    contGrad.append('stop').attr('offset', '0%').attr('stop-color', '#34d399');
    contGrad.append('stop').attr('offset', '100%').attr('stop-color', '#059669');

    // Glow Filter
    const filter = defs.append('filter').attr('id', 'glow').attr('x', '-30%').attr('y', '-30%').attr('width', '160%').attr('height', '160%');
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    const merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    // 9. Simulation Ticks
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // 10. Drag handlers
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
      svg.style('cursor', 'grabbing');
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
      svg.style('cursor', 'grab');
    }

    // Zoom Functions exposing
    window.zoomIn = () => svg.transition().call(zoom.scaleBy, 1.3);
    window.zoomOut = () => svg.transition().call(zoom.scaleBy, 0.7);
    window.zoomReset = () => svg.transition().call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8));

    return () => {
      simulation.stop();
    };
  }, [cards]);

  // Apply search query highlighting to node circles in D3 directly
  useEffect(() => {
    if (!svgRef.current || cards.length === 0) return;

    const svg = d3.select(svgRef.current);
    const nodes = svg.selectAll('.node');

    if (searchQuery.trim() === '') {
      // Reset to original styling
      nodes.each(function(d) {
        const circle = d3.select(this).select('circle');
        if (d.type === 'company') {
          circle.attr('fill', 'url(#companyGradient)').attr('stroke', '#6366f1');
        } else {
          circle.attr('fill', 'url(#contactGradient)').attr('stroke', '#10b981');
        }
      });
      return;
    }

    const q = searchQuery.toLowerCase();

    nodes.each(function(d) {
      const circle = d3.select(this).select('circle');
      const isMatch = d.label.toLowerCase().includes(q) || 
        (d.type === 'contact' && (
          (d.designation || '').toLowerCase().includes(q) ||
          (d.company || '').toLowerCase().includes(q)
        ));

      if (isMatch) {
        circle.attr('fill', '#ec4899').attr('stroke', '#f472b6'); // Highlight match
      } else {
        // Dim non-matches
        circle.attr('fill', '#1e293b').attr('stroke', '#334155');
      }
    });
  }, [searchQuery, cards]);

  const generateVCard = (card) => {
    const vCardData = `BEGIN:VCARD\nVERSION:3.0\nFN:${card.person_name}\nORG:${card.company_name || ''}\nTITLE:${card.designation || ''}\nTEL;TYPE=WORK,VOICE:${card.phone || ''}\nEMAIL:${card.email || ''}\nADR;TYPE=WORK:;;${card.address || ''}\nEND:VCARD`;
    const blob = new Blob([vCardData], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${card.person_name || 'contact'}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4" ref={containerRef}>
      {/* Search Graph bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col md:flex-row items-center gap-3">
        <div className="relative group w-full flex-1">
          <div className="absolute left-3.5 top-3 text-gray-500 group-focus-within:text-indigo-400 transition-colors">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search network nodes..."
            className="w-full bg-slate-800/80 border border-slate-750 text-white pl-10 pr-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder-gray-500 text-sm font-medium"
          />
        </div>
        
        {/* Graph zoom controls */}
        <div className="flex gap-2 shrink-0">
          <button onClick={() => window.zoomIn?.()} className="p-2.5 bg-slate-800 border border-slate-750 text-gray-400 hover:text-white rounded-xl cursor-pointer">
            <ZoomIn size={16} />
          </button>
          <button onClick={() => window.zoomOut?.()} className="p-2.5 bg-slate-800 border border-slate-750 text-gray-400 hover:text-white rounded-xl cursor-pointer">
            <ZoomOut size={16} />
          </button>
          <button onClick={() => window.zoomReset?.()} className="p-2.5 bg-slate-800 border border-slate-750 text-gray-400 hover:text-white rounded-xl cursor-pointer">
            <Maximize2 size={16} />
          </button>
          <button onClick={() => setShowHelp(!showHelp)} className={`p-2.5 rounded-xl border cursor-pointer ${showHelp ? 'bg-indigo-950/30 border-indigo-900/40 text-indigo-400' : 'bg-slate-800 border-slate-750 text-gray-400 hover:text-white'}`}>
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      {/* Floating Instructions */}
      <AnimatePresence>
        {showHelp && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-indigo-950/20 border border-indigo-900/20 rounded-2xl p-3 text-xs text-indigo-300/80 flex items-center justify-between gap-4"
          >
            <span>💡 <strong>Tip:</strong> Drag nodes to re-arrange • Pinch or scroll to zoom • Click a Company hub to view its employees • Click a Contact satellite to view details.</span>
            <button onClick={() => setShowHelp(false)} className="text-indigo-400 hover:text-white"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Network Canvas */}
      <div className="relative bg-slate-950 border border-slate-900 rounded-[2rem] overflow-hidden shadow-2xl h-[480px]">
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <Building size={48} className="text-gray-700 mb-4 animate-pulse" />
            <h3 className="text-gray-400 font-bold">No contacts available to plot</h3>
            <p className="text-xs text-gray-500 mt-1">Add or scan a few contacts to generate your network graph.</p>
          </div>
        ) : (
          <svg ref={svgRef} className="w-full h-full block" />
        )}

        {/* Selected Contact Card overlay drawer */}
        <AnimatePresence>
          {selectedCard && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-4 left-4 right-4 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 max-w-md mx-auto z-20"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex gap-3 items-center">
                  <div className="h-10 w-10 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0">
                    <User size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white leading-tight">{selectedCard.person_name}</h4>
                    <p className="text-xs text-indigo-400 font-semibold mt-0.5">
                      {selectedCard.designation && <>{selectedCard.designation} at </>}
                      {selectedCard.company_name || 'Independent'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedCard(null)} className="text-gray-500 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 text-xs text-gray-300">
                {selectedCard.email && (
                  <div className="flex items-center gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                    <Mail size={14} className="text-gray-500 shrink-0" />
                    <a href={`mailto:${selectedCard.email}`} className="hover:text-indigo-400 hover:underline truncate">{selectedCard.email}</a>
                  </div>
                )}
                {selectedCard.phone && (
                  <div className="flex items-center gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                    <Phone size={14} className="text-gray-500 shrink-0" />
                    <a href={`tel:${selectedCard.phone}`} className="hover:text-indigo-400 hover:underline">{selectedCard.phone}</a>
                  </div>
                )}
                {selectedCard.address && (
                  <div className="flex items-start gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                    <MapPin size={14} className="text-gray-500 shrink-0 mt-0.5" />
                    <span>{selectedCard.address}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => generateVCard(selectedCard)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Smartphone size={14} /> Export vCard
                </button>
              </div>
            </motion.div>
          )}

          {/* Selected Company Hub Contacts Drawer */}
          {selectedCompanyContacts && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-4 left-4 right-4 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[300px] overflow-y-auto max-w-md mx-auto z-20"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Building size={16} className="text-indigo-400" />
                  <h4 className="text-sm font-bold text-white leading-tight">
                    {selectedCompanyContacts.name} Hub ({selectedCompanyContacts.contacts.length})
                  </h4>
                </div>
                <button onClick={() => setSelectedCompanyContacts(null)} className="text-gray-500 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2.5">
                {selectedCompanyContacts.contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex justify-between items-center bg-slate-950/50 p-2.5 rounded-xl border border-slate-850 hover:border-indigo-500/30 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedCard(contact);
                      setSelectedCompanyContacts(null);
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">{contact.person_name}</div>
                      <div className="text-[10px] text-gray-400 truncate mt-0.5">{contact.designation || 'No Designation'}</div>
                    </div>
                    <div className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full shrink-0">
                      View
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
