// diagram.js — Interactive workspace architecture diagram using D3 force simulation

window.ICM = window.ICM || {};

window.ICM.diagram = {

  // Layer color palette (Bauhaus industrial — matches css/styles.css --l0–l5)
  LAYER_COLORS: {
    L0: '#047857',
    L1: '#465d81',
    L2: '#5f759b',
    L3: '#7d5800',
    L4: '#6b7280',
    L5: '#059669'
  },

  LAYER_LABELS: {
    L0: 'Layer 0 — Map',
    L1: 'Layer 1 — Router',
    L2: 'Layer 2 — Stage Contract',
    L3: 'Layer 3 — Reference',
    L4: 'Layer 4 — Output',
    L5: 'Layer 5 — Skill Starters'
  },

  render(containerId, answers) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const width = container.clientWidth > 0 ? container.clientWidth : 800;
    const height = container.clientHeight > 0 ? container.clientHeight : 500;

    // Build nodes and links from answers
    const { nodes, links } = this.buildGraph(answers, width, height);

    // Create SVG
    const svg = d3.select(`#${containerId}`)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('background', 'rgba(243, 243, 243, 0.92)');

    // Arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#8f6f6e');

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(d => d.distance || 120).strength(0.8))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05))
      .force('collision', d3.forceCollide(50));

    // Draw links
    const link = svg.append('g').selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => d.color || '#8f6f6e')
      .attr('stroke-width', d => d.width || 1.5)
      .attr('stroke-dasharray', d => d.dashed ? '5,4' : null)
      .attr('marker-end', 'url(#arrow)')
      .attr('opacity', 0.7);

    // Link labels
    const linkLabel = svg.append('g').selectAll('text')
      .data(links.filter(l => l.label))
      .join('text')
      .attr('font-size', 9)
      .attr('fill', '#5b403f')
      .attr('text-anchor', 'middle')
      .text(d => d.label);

    // Draw nodes
    const nodeGroup = svg.append('g').selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
      )
      .on('click', (event, d) => {
        if (d.fileKey && window.ICM.app) {
          window.ICM.app.highlightFile(d.fileKey);
        }
        // Pulse effect
        d3.select(event.currentTarget).select('circle')
          .transition().duration(150).attr('r', d.radius * 1.4)
          .transition().duration(150).attr('r', d.radius);
      });

    // Node circles
    nodeGroup.append('circle')
      .attr('r', d => d.radius || 24)
      .attr('fill', d => this.LAYER_COLORS[d.layer] || '#8f6f6e')
      .attr('opacity', 0.9)
      .attr('stroke', '#1a1c1c')
      .attr('stroke-width', 2);

    // Layer badge
    nodeGroup.append('text')
      .attr('dy', '-0.9em')
      .attr('text-anchor', 'middle')
      .attr('font-size', 8)
      .attr('fill', d => this.LAYER_COLORS[d.layer] || '#5b403f')
      .attr('font-weight', '600')
      .attr('letter-spacing', '0.05em')
      .text(d => d.layer);

    // Node icons / initials
    nodeGroup.append('text')
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', d => d.iconSize || 13)
      .attr('fill', '#ffffff')
      .attr('font-weight', '700')
      .text(d => d.icon || d.label.slice(0, 2));

    // Node labels below
    nodeGroup.append('text')
      .attr('dy', d => (d.radius || 24) + 14)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('fill', '#1a1c1c')
      .attr('font-weight', '500')
      .text(d => d.label);

    // Subtitle
    nodeGroup.append('text')
      .attr('dy', d => (d.radius || 24) + 26)
      .attr('text-anchor', 'middle')
      .attr('font-size', 8)
      .attr('fill', '#5b403f')
      .text(d => d.sublabel || '');

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'diagram-tooltip')
      .style('position', 'fixed')
      .style('background', '#ffffff')
      .style('padding', '10px 14px')
      .style('font-size', '12px')
      .style('font-family', "'JetBrains Mono', ui-monospace, monospace")
      .style('max-width', '240px')
      .style('pointer-events', 'none')
      .style('opacity', '0')
      .style('z-index', '1000')
      .style('line-height', '1.5');

    nodeGroup
      .on('mouseenter', (event, d) => {
        const layerLabel = this.LAYER_LABELS[d.layer] || d.layer;
        tooltip
          .style('opacity', '1')
          .html(`<strong>${d.label}</strong><br>
            <span style="color:#5b403f;font-size:10px">${layerLabel}</span><br>
            ${d.description ? `<span style="margin-top:4px;display:block;color:#1a1c1c">${d.description}</span>` : ''}
            ${d.fileKey ? `<span style="color:#047857;font-size:10px;margin-top:4px;display:block">Click to preview file →</span>` : ''}`);
      })
      .on('mousemove', event => {
        tooltip
          .style('left', (event.clientX + 14) + 'px')
          .style('top', (event.clientY - 8) + 'px');
      })
      .on('mouseleave', () => tooltip.style('opacity', '0'));

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      linkLabel
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2);

      nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Legend
    this.renderLegend(svg, width);

    // Store simulation reference for cleanup
    container._simulation = simulation;

    return simulation;
  },

  buildGraph(answers, width, height) {
    const { project_name, stages, archetype } = answers;
    const cx = width / 2;
    const cy = height / 2;

    const nodes = [];
    const links = [];

    // L0 — CLAUDE.md (center top)
    nodes.push({
      id: 'claude',
      label: 'CLAUDE.md',
      sublabel: 'Always loaded',
      layer: 'L0',
      icon: '⌂',
      iconSize: 16,
      radius: 32,
      x: cx,
      y: cy - 160,
      fileKey: `${project_name}/CLAUDE.md`,
      description: 'The map. Loaded at the start of every session. Contains identity, routing table, and naming conventions.'
    });

    // L1 — CONTEXT.md (below CLAUDE.md)
    nodes.push({
      id: 'context',
      label: 'CONTEXT.md',
      sublabel: 'Workflow router',
      layer: 'L1',
      icon: '⇒',
      iconSize: 16,
      radius: 26,
      x: cx,
      y: cy - 60,
      fileKey: `${project_name}/CONTEXT.md`,
      description: 'The router. Loaded on workspace entry. Contains the stage map and how stages connect.'
    });

    links.push({
      source: 'claude',
      target: 'context',
      label: 'routes to',
      color: '#465d81',
      width: 2,
      distance: 110
    });

    // L2 — Stage nodes (spread horizontally)
    const stageCount = stages.length;
    const stageSpread = Math.min(width * 0.7, stageCount * 140);
    const stageStartX = cx - stageSpread / 2 + stageSpread / (stageCount * 2);

    stages.forEach((stage, i) => {
      const stageNum = String(i + 1).padStart(2, '0');
      const stageId = `stage_${i}`;
      const stageX = stageStartX + (stageSpread / stageCount) * i;

      nodes.push({
        id: stageId,
        label: `${stageNum}_${stage.slug}`,
        sublabel: stage.label,
        layer: 'L2',
        icon: String(i + 1),
        iconSize: 14,
        radius: 24,
        x: stageX,
        y: cy + 50,
        fileKey: `${project_name}/${stageNum}_${stage.slug}/CONTEXT.md`,
        description: stage.description || `Stage contract for ${stage.label}. Defines inputs, process, and output.`
      });

      links.push({
        source: 'context',
        target: stageId,
        color: '#5f759b',
        width: 1.5,
        distance: 130
      });

      // Stage → stage sequential links
      if (i > 0) {
        links.push({
          source: `stage_${i - 1}`,
          target: stageId,
          label: 'output →',
          color: '#8f6f6e',
          width: 1,
          dashed: true,
          distance: stageSpread / stageCount
        });
      }

      // L4 — Output node for each stage
      const outputId = `output_${i}`;
      nodes.push({
        id: outputId,
        label: 'output/',
        sublabel: 'Handoff point',
        layer: 'L4',
        icon: '↓',
        iconSize: 13,
        radius: 16,
        x: stageX,
        y: cy + 140,
        description: `Output directory for ${stage.label}. Human reviews here before the next stage begins.`
      });

      links.push({
        source: stageId,
        target: outputId,
        color: '#8f6f6e',
        width: 1,
        distance: 80
      });
    });

    // L3 — Config nodes (bottom area, spread)
    const configFiles = [
      { id: 'voice', label: 'voice-and-tone.md', icon: 'V', fileKey: `${project_name}/_config/voice-and-tone.md`, description: 'Voice and tone reference. Load in writing stages.' },
      { id: 'format', label: 'format-patterns.md', icon: 'F', fileKey: `${project_name}/_config/format-patterns.md`, description: 'Format patterns per content type. Load when format matters.' },
      { id: 'constraints', label: 'constraints.md', icon: 'C', fileKey: `${project_name}/_config/constraints.md`, description: 'Hard rules for written output. Load in all writing stages.' }
    ];

    if (archetype === 'freelancer') {
      configFiles.push({ id: 'brief', label: 'client-brief.md', icon: 'B', fileKey: `${project_name}/_config/client-brief.md`, description: 'Original client communication. Historical reference after discovery.' });
      configFiles.push({ id: 'scope', label: 'scope-agreement.md', icon: 'S', fileKey: `${project_name}/_config/scope-agreement.md`, description: 'Working specification. All build stages work from this.' });
    }

    const configSpread = Math.min(width * 0.6, configFiles.length * 130);
    const configStartX = cx - configSpread / 2 + configSpread / (configFiles.length * 2);

    configFiles.forEach((cfg, i) => {
      nodes.push({
        id: `config_${cfg.id}`,
        label: cfg.label,
        sublabel: '_config/',
        layer: 'L3',
        icon: cfg.icon,
        iconSize: 12,
        radius: 18,
        x: configStartX + (configSpread / configFiles.length) * i,
        y: cy + 220,
        fileKey: cfg.fileKey,
        description: cfg.description
      });

      // Connect to the stage(s) that need this config
      const connectToStage = i < stages.length ? i : stages.length - 1;
      links.push({
        source: `stage_${connectToStage}`,
        target: `config_${cfg.id}`,
        color: '#ffb702',
        width: 1,
        dashed: true,
        distance: 160
      });
    });

    // L5 — Skill starters
    const skills = [
      {
        id: 'skills_readme',
        label: 'skill-starters/',
        sublabel: 'Reusable prompts',
        icon: '⋆',
        fileKey: `${project_name}/skill-starters/README.md`,
        description: 'Reusable prompt templates (“skills”) for starting work in each stage.'
      }
    ];

    const skillsSpread = Math.min(width * 0.45, skills.length * 180);
    const skillsStartX = cx - skillsSpread / 2 + skillsSpread / (skills.length * 2);

    skills.forEach((sk, i) => {
      nodes.push({
        id: `skill_${sk.id}`,
        label: sk.label,
        sublabel: sk.sublabel,
        layer: 'L5',
        icon: sk.icon,
        iconSize: 14,
        radius: 20,
        x: skillsStartX + (skillsSpread / skills.length) * i,
        y: cy + 300,
        fileKey: sk.fileKey,
        description: sk.description
      });

      links.push({
        source: 'context',
        target: `skill_${sk.id}`,
        color: '#059669',
        width: 1.2,
        dashed: true,
        distance: 210
      });
    });

    return { nodes, links };
  },

  renderLegend(svg, width) {
    const layers = Object.entries(this.LAYER_COLORS);
    const legendX = 16;
    const legendY = 16;

    const legend = svg.append('g').attr('transform', `translate(${legendX},${legendY})`);

    legend.append('rect')
      .attr('x', -8).attr('y', -8)
      .attr('width', 170).attr('height', layers.length * 22 + 16)
      .attr('rx', 0)
      .attr('fill', '#ffffff')
      .attr('opacity', 0.95)
      .attr('stroke', '#1a1c1c')
      .attr('stroke-width', 2);

    layers.forEach(([layer, color], i) => {
      const g = legend.append('g').attr('transform', `translate(0,${i * 22})`);
      g.append('circle').attr('cx', 8).attr('cy', 7).attr('r', 6).attr('fill', color);
      g.append('text').attr('x', 20).attr('y', 12)
        .attr('font-size', 10).attr('fill', '#1a1c1c')
        .text(this.LAYER_LABELS[layer]);
    });
  },

  destroy(containerId) {
    const container = document.getElementById(containerId);
    if (container && container._simulation) {
      container._simulation.stop();
    }
    d3.select(`#${containerId}`).selectAll('*').remove();
    d3.selectAll('.diagram-tooltip').remove();
  }
};
