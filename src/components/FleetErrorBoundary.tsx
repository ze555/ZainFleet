import React from 'react';

type State = { message: string | null };
/** Keep frontend failures visible instead of leaving the fleet screen entirely blank. */
export class FleetErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { message: null };
  static getDerivedStateFromError(error: Error): State {
    return { message: error?.message || 'Unknown rendering error' };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ZainFleet UI render failure]', error, info.componentStack);
  }
  render() {
    if (!this.state.message) return this.props.children;
    return <main lang="ar" dir="rtl" style={{minHeight:'100dvh',padding:'24px',display:'grid',placeItems:'center',background:'#061427',color:'#e7f5ff',fontFamily:'Cairo,Arial,sans-serif'}}>
      <section style={{width:'min(100%,530px)',border:'1px solid #278cd0',borderRadius:22,padding:25,background:'#0b2441'}}>
        <h1 style={{fontSize:23,fontWeight:900,marginBottom:12}}>تعذر عرض لوحة ZainFleet</h1>
        <p style={{lineHeight:2,fontSize:14}}>حدث خطأ في واجهة الموقع. اتصال جهاز GPS بالخادم مستقل عن هذه الصفحة. يمكنك إعادة المحاولة أو إرسال تفاصيل الخطأ للدعم.</p>
        <pre dir="ltr" style={{margin:'18px 0',padding:12,background:'#041023',borderRadius:10,color:'#ffc7aa',whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:12}}>{this.state.message}</pre>
        <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
          <button type="button" onClick={()=>this.setState({message:null})} style={{border:0,borderRadius:12,padding:'12px 20px',background:'#087ed0',color:'white',fontWeight:800}}>إعادة المحاولة</button>
          <button type="button" onClick={()=>window.location.reload()} style={{border:'1px solid #278cd0',borderRadius:12,padding:'12px 20px',background:'#113754',color:'white',fontWeight:800}}>تحديث الصفحة</button>
        </div>
      </section>
    </main>;
  }
}
