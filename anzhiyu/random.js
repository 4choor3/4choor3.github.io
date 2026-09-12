var posts=["2026/09/08/a-share-quant-start/","2026/09/08/blog-rebuilt-three-times/","2026/09/08/hello-world/","2026/09/08/hpc-slurm-notes/","2026/09/08/python-toolchain/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };