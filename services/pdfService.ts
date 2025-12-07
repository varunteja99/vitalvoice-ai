import { jsPDF } from "jspdf";
import { HealthAnalysis } from "../types";

export const generatePDF = (data: HealthAnalysis) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // --- Header ---
  doc.setFontSize(22);
  doc.setTextColor(66, 133, 244); // Google Blue #4285F4
  doc.setFont("helvetica", "bold");
  doc.text("VitalVoice AI", margin, yPos);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  doc.text("Clinical Screening Report", margin + 65, yPos);
  
  doc.text(new Date().toLocaleString(), pageWidth - margin, yPos, { align: 'right' });
  
  yPos += 15;
  
  // --- Overall Score Box ---
  doc.setFillColor(245, 247, 250); // Light Grey
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 35, 3, 3, 'FD');
  
  doc.setFontSize(12);
  doc.setTextColor(80);
  doc.text("Overall Wellness Score", margin + 10, yPos + 12);
  
  doc.setFontSize(24);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(data.overall_wellness_score.toString() + "/100", margin + 10, yPos + 26);
  
  // Summary in the box
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  
  // Split summary text to fit next to score
  const summaryX = margin + 70;
  const summaryWidth = pageWidth - margin - summaryX - 5;
  const summaryLines = doc.splitTextToSize(data.summary, summaryWidth);
  doc.text(summaryLines, summaryX, yPos + 10);
  
  yPos += 50;

  // --- Domain Scores Table ---
  doc.setFontSize(14);
  doc.setTextColor(66, 133, 244);
  doc.setFont("helvetica", "bold");
  doc.text("Domain Analysis", margin, yPos);
  
  doc.setDrawColor(66, 133, 244);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
  
  yPos += 15;

  const domains = Object.entries(data.domain_scores);
  
  domains.forEach(([key, value]) => {
    // Check page break
    if (yPos > 260) {
      doc.addPage();
      yPos = 20;
    }

    const title = key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ');
    
    // Domain Title
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin, yPos);
    
    // Score
    doc.setFont("helvetica", "normal");
    doc.text(value.score.toString(), margin + 50, yPos);
    
    // Concern Level (Color Coded)
    let concernR = 100, concernG = 100, concernB = 100;
    if (value.concern_level === 'low') { concernR=34; concernG=197; concernB=94; } // Green
    else if (value.concern_level === 'moderate') { concernR=234; concernG=179; concernB=8; } // Yellow/Gold
    else if (value.concern_level === 'elevated') { concernR=249; concernG=115; concernB=22; } // Orange
    else if (value.concern_level === 'high') { concernR=239; concernG=68; concernB=68; } // Red
    
    doc.setTextColor(concernR, concernG, concernB);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(value.concern_level.toUpperCase(), margin + 70, yPos);
    
    // Explanation
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.setFontSize(10);
    const explanationLines = doc.splitTextToSize(value.explanation, pageWidth - margin - 110);
    doc.text(explanationLines, margin + 100, yPos);
    
    // Calculate height of this row based on explanation text
    const rowHeight = Math.max(10, explanationLines.length * 5);
    yPos += rowHeight + 8;
  });

  yPos += 5;

  // --- Observations ---
  if (yPos > 240) {
     doc.addPage();
     yPos = 20;
  }
  
  doc.setFontSize(14);
  doc.setTextColor(66, 133, 244);
  doc.setFont("helvetica", "bold");
  doc.text("Key Observations", margin, yPos);
  doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
  yPos += 12;
  
  data.key_observations.forEach((obs) => {
      if (yPos > 270) { doc.addPage(); yPos=20; }
      
      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("• " + obs.finding, margin, yPos);
      
      const sigWidth = pageWidth - margin - 15;
      const sigLines = doc.splitTextToSize("Significance: " + obs.significance, sigWidth);
      
      yPos += 5;
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100);
      doc.text(sigLines, margin + 5, yPos);
      
      yPos += (sigLines.length * 5) + 6;
  });

  yPos += 5;

  // --- Recommendations ---
  if (yPos > 240) {
     doc.addPage();
     yPos = 20;
  }
  
  doc.setFontSize(14);
  doc.setTextColor(66, 133, 244);
  doc.setFont("helvetica", "bold");
  doc.text("Recommendations", margin, yPos);
  doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
  yPos += 12;
  
  data.recommendations.forEach((rec) => {
      if (yPos > 270) { doc.addPage(); yPos=20; }
      
      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("• " + rec.action, margin, yPos);
      
      // Urgency Tag
      let uColor = [100,100,100];
      if(rec.urgency === 'prompt') uColor = [220, 50, 50];
      if(rec.urgency === 'soon') uColor = [200, 150, 0];
      
      doc.setTextColor(uColor[0], uColor[1], uColor[2]);
      doc.setFontSize(8);
      const textWidth = doc.getTextWidth("• " + rec.action);
      doc.text(`[${rec.urgency.toUpperCase()}]`, margin + textWidth + 2, yPos);
      
      const reasonLines = doc.splitTextToSize("Reason: " + rec.reason, pageWidth - margin - 15);
      
      yPos += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(reasonLines, margin + 5, yPos);
      
      yPos += (reasonLines.length * 5) + 6;
  });

  // --- Footer ---
  const pageCount = doc.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Footer Line
      doc.setDrawColor(200);
      doc.setLineWidth(0.1);
      doc.line(margin, 275, pageWidth - margin, 275);
      
      doc.setFontSize(8);
      doc.setTextColor(150);
      
      // Disclaimer
      const disclaimer = "DISCLAIMER: " + data.disclaimer;
      const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - (margin * 2));
      doc.text(splitDisclaimer, margin, 282);
      
      // Page Number
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, 290, { align: 'right' });
      doc.text("Generated by VitalVoice AI powered by Gemini", margin, 290);
  }

  doc.save("VitalVoice_Analysis_Report.pdf");
};