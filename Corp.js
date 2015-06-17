/*
 * Corp.js
 * 
 * an object-oriented representation of a corporation
 * mengwong@legalese.io 20150615
 * 
 */

require('joose'); // http://joose.github.io/Joose/doc/html/Joose.html

// a shareholder or debtholder. some kind of person. superclass for a Corp
Class('Person', {
  has: { name:    { is: 'ro', required:true, },
		 idtype:  { is: 'ro', required:true, },
		 id:      { is: 'rw', required:true, },
		 address: { is: 'rw', required:false, },
		 state:   { is: 'rw', required:true, },
	   },
  methods: { getAddress1Line: function() { return this.address.replace(/\n/g,", ") },
		   },
});

// a corporate security like a bond, equity, or warrant
Class('Security', {
  has: { name:      {is:'ro',required:true, },
		 corp:      {is:'ro',required:true, },
		 essential: {is:'rw',required:false, }, // corresponds to Legalese's security_essential
		 redeemable:{is:'ro',required:false, },
		 redeemableByCompany:{is:'ro',required:false, },
		 redeemableByHolder: {is:'ro',required:false, },
		 voting:    {is:'ro',required:false,init:function(){return false}},
	   },
});

// equity
Class('Security.Equity', {
  isa: Security,
});

// a note/debenture/bond
Class('Security.Debt', {
  isa: Security,
  has: { interestRate: {is:'ro',required:true,},
		 maturityDate: {is:'ro',required:true,},
                 valuationCap: {is:'ro',required:false,},
                 	 
	   },
});

// a convertible instrument. this is a role and can be mixed in to either debt or equity
Role('Convertible', {
  has: { convertsTo:         {is:'rw',required:true}, // "Next Round Security'
		 futureRoundHandler: {is:'rw',required:true}, // callback function
		 convert:            {is:'rw',required:true}, // callback function
	   },
  // TODO: write an AFTER Joose initializer that automatically converts any securities from earlier rounds by testing
});

Class('Security.ConvertibleDebt', {
  isa: Security.Debt,
  does: Convertible,
});

Class('Security.ConvertibleEquity', {
  isa: Security.Equity,
  does: Convertible,
});

// a Person holds a certain number of shares. this is used both within a round and for a cumulative total.
Class('Corp.Holding', {
  has: { security:   { is: 'rw', required:true  }, // isa: Security
		 commitment: { is: 'rw', required:true  }, // Number -- the combined price
		 currency:   { is: 'rw', required:true  }, // USD or SGD or S$ etc
		 num_units:  { is: 'rw', required:false }, // Number: number of shares
		 price_per:  { is: 'rw', required:false }, // Number: price per share
		 corp:         { is: 'ro', required:true, },
	   },
  methods: {
	BUILD: resolveName([{thing:"security",getter:"getSecurities"}]), // convert securityName to actual security
	show: function() {return this.getCurrency() + this.getCommitment()},
  },
});

// some syntactic sugar allowing us to instantiate with either a security: or a securityName:
function resolveName(names) {
  return function(params) {
	names.forEach(function(n){
	  if (params[n.thing]==undefined) {
		params[n.thing] = params.corp[n.getter]()[params[n.thing+"Name"]];
		delete params[n.thing+"Name"];
	  }
	});
	return params;
  }
}

// a round of funding. think of this as a column in a traditional captable.
Class('Corp.Round', {
  has: { name:         { is: 'rw', required:true, },
		 pre_money:    { is: 'rw', required:false },
		 security:     { is: 'rw', required:true, },
		 subscriptions:{ is: 'rw', required:false, init: function(){return {} }}, // isa:{Person.name:[Holding]}
		 waivers:      { is: 'rw', required:false, init: function(){return {} }}, // isa:{Person.name:[Holding]}
		 date:         { is: 'rw', required:false, },
		 pricePerShare:{ is: 'rw', required:false, },
		 corp:         { is: 'ro', required:true, },
	   },
  methods: { fundsRaised: function(params) { var keys = Object.keys(this.getSubscriptions());
											 var sum = 0;
											 for (var i = 0; i < keys.length; i++) {
											   var holding = this.getSubscriptions()[keys[i]];
											   sum = sum + holding.getCommitment();
											 }
											 return (params.showCurrency ? this.getSubscriptions()[keys[0]].getCurrency() + sum : sum);
										   },
			 postMoney:   function() { }, // what is the post-money valuation of the company?
			 conversion:  function() { }, // execute any conversions that occurred in previous rounds
			 BUILD: resolveName([{thing:"security",getter:"getSecurities"}]), // convert securityName to actual security
			 display:     function(params) {
			   console.log(" ## " + this.fundsRaised({showCurrency:true}) + " of " + this.getSecurity().getName() + " were issued to " + Object.keys(this.getSubscriptions()).length + " subscribers" +
						   (this.getPricePerShare() ? (" at " + this.getPricePerShare() + " per share") : ""));
			   for (var sub in this.getSubscriptions()) {
				 console.log("  - " + sub + " put in " + this.getSubscriptions()[sub].show());
			   }
			 },
		   },
});

// contains multiple rounds of fundraising and other events relevant to a captable
Class('Corp.Captable', {
  has: { rounds:   { is: 'rw', init: function(){return [] }}, // isa:[Corp.Round]
		 corp:     { is: 'ro', required:true, },
	   },
  methods: { asOf: function(round) {
	// TODO: compute the overall situation as of a given round.
	// return { holders:  [ Person, ... ],
	//          holdings: { personName : [ Holding, ... ], ... }
	//          paidupCapital: { currency: N, ... }
	//          fundsRaised:   { currency: N, ... }
	//          securities: { securityName: { num_units: N, fundsRaised: { currency: N, ... } }, ... }
  },
			 display: function(params) {
			   for (var round_i = 1; round_i <= this.rounds.length; round_i++) {
				 var round = this.rounds[round_i-1];
				 console.log("### round " + round_i + ": " + round.getName());
				 round.display(params);
			   }
			 },
		   },
});

// a corporation
Class('Corp', {
  isa: Person,
  has: { name       : {is:'rw',required:true,  },
		 captable   : {is:'rw',required:false, init: function(){return new Corp.Captable({corp:this})} },
		 holders    : {is:'rw',init: function(){return {} }}, // isa:{holderName:Corp.Holder}
		 securities : {is:'rw',init: function(){return {} }}, // isa:{securityName:Corp.Security}
		 ruleDepth  : {is:'rw',init: function(){return 0  }},
	   },
  methods : {
	display: function (params) {
	  params = params || {};
	  console.log("### display() --- " + this.getName()+" ("+this.getIdtype()+" "+this.getId() + ")\n"+
				  (params.address ? ("    a Corp registered in " + this.getState() + "\n" +
									 "    with its office at " + this.getAddress1Line() + "\n") : "") +
				  "    has " + Object.keys(this.getSecurities()).length + " classes of securities" + "\n" +
				  "    has " + Object.keys(this.getHolders()).length + " holders of securities" + "\n" +
				  "    has " + this.getCaptable().getRounds().length + " rounds of funding"
				 ); },
	newSecurity: function(security) { // name, etc
	  this.getSecurities()[security.getName()] = this.getSecurities()[security.getName()] || security;
	  console.log("#   registered a new security: " + security.getName());
	  return this.getSecurities()[security.getName()];
	},
	newRound: function(params) { // name:, pre_money:, security:, subscriptions:[ {person:, holding:}, ]
	  // create any holders which are not already known to the corp
	  var subscriptions = {};
	  var corp = this;
	  params.subscriptions.forEach(function(sub){
		if (sub.person.constructor == "Person") {
		  corp.getHolders()[sub.person.getName()] = corp.getHolders()[sub.person.getName()] || sub.person;
		  subscriptions[sub.person.getName()] = sub.holding;
		} else {
		  subscriptions[sub.person] = sub.holding;
		}
	  });
	  this.getCaptable().getRounds().push(new Corp.Round({name:         params.name,
														  pre_money:    params.pre_money,
														  securityName: params.securityName,
														  pricePerShare: params.pricePerShare,
														  subscriptions:subscriptions,
														  corp:         corp}));
	  console.log(" ## created a new round of " + params.securityName + " with " + Object.keys(subscriptions).length + " subscribers");
	},

	/* ------------------------------ rules begin with r ---------------------------- */
	// a rule calls all of its prerequisite rules.

	rIssue:       function(counterfactual, prerequisites) { },
	rIssueEquity: function(counterfactual, prerequisites) { },
	rIssueDebt:   function(counterfactual, prerequisites) { },

	rNewRound:    function(counterfactual, prerequisites) {
	  this.ruleLog("rNewRound","does the corporation's constitutional documents already define the security?");
	  if (this.getSecurities()[counterfactual.params.securityName]) { this.ruleLog("rNewRound","yes") }
	  else {
		this.ruleLog("rNewRound","no");
		prerequisites.push(
		  this.howTo({method:this.newSecurity,
					  params:{ securityName: counterfactual.params.securityName },
					 }));
	  }
	},

	rNewSecurity: function(counterfactual, prerequisites) {
	  this.ruleLog("rNewSecurity","so you want to create a new class of security. can we proceed??");
	  // prerequisite: rConstitutionalAmendment
	},

	rConstitutionalAmendment: function(counterfactual, prerequisites) {
	  this.ruleLog("rConstitutionalAmendment","may the directors proceed to amend the constitutional documents?");
	  // prerequisite: rMembersResolution
	},

	rMembersResolution: function(counterfactual, prerequisites) {
	  // prerequisites: rMembersNotice && rMembersQuorum
	  // count the poll vote or number of signatures
	},
	
	rMembersNotice: function(counterfactual, prerequisites) {
	  // prerequisites: rDirectorsResolution || rmembersNoticeByMember
	},
	
	rMembersQuorum: function(counterfactual, prerequisites) {
	  // prerequisites: count the number of signatures or directors present
	},
	
	rDirectorsResolution: function(counterfactual, prerequisites) {
	  // prerequisites: rDirectorsQuorum
	},
	
	rDirectorsQuorum: function(counterfactual, prerequisites) {
	},
	

	// the howTo computes the prerequisites for a proposed course of action
	
	howTo:        function(counterfactual) {
	  var prerequisites = [];
	  switch (counterfactual.method) {
	  case this.newSecurity:
		this.ruleLog("howTo(newSecurity)","so you want to create a new security. how do you do that?");
		return this.rNewSecurity(counterfactual, prerequisites);
		break;
	  case this.newRound:
		this.ruleLog("howTo(newRound)", "so you want to issue a new round of '"+counterfactual.params.securityName+"' securities. how do you do that?");
		return this.rNewRound(counterfactual, prerequisites);
		break;
	  default:
		this.ruleLog("howTo", counterfactual.method);
	  }
	},

  	// make debug easier
	ruleLog:      function(caller, str) {
	  var prefix = "";
	  for (var d = 0; d<this.ruleDepth; d++) { prefix = prefix + "| "; }
	  console.log(prefix + caller + ": " + str);
	},
  },
  // TODO: replace this with an introspective foreach methodname, define before: deepen
  before: { rIssue:       deepen,
			rNewSecurity: deepen,
			rNewRound:    deepen,
			howTo:        deepen,
		  },
  after:  { rIssue:       lift,
			rNewSecurity: lift,
			rNewRound:    lift,
			howTo:        lift,
		  },
});

function deepen() { this.ruleDepth++ }
function lift()   { this.ruleDepth-- }

// need a generic new Security function that constructs the appropriate type based on the signature passed in
